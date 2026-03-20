import type { RenderContext } from '../types.js';
import { getContextPercent, getBufferedPercent, getModelName, getProviderLabel, getTotalTokens } from '../stdin.js';
import { getOutputSpeed } from '../speed-tracker.js';
import { formatUsageDisplay } from './format.js';
import { coloredBar, cyan, dim, magenta, yellow, getContextColor, RESET } from './colors.js';

const DEBUG = process.env.DEBUG?.includes('claude-hud') || process.env.DEBUG === '*';

/**
 * Renders the full session line (model + context bar + project + git + counts + usage + duration).
 * Used for compact layout mode.
 */
export function renderSessionLine(ctx: RenderContext): string {
  const model = getModelName(ctx.stdin);

  const rawPercent = getContextPercent(ctx.stdin);
  const bufferedPercent = getBufferedPercent(ctx.stdin);
  const autocompactMode = ctx.config?.display?.autocompactBuffer ?? 'enabled';
  const percent = autocompactMode === 'disabled' ? rawPercent : bufferedPercent;

  if (DEBUG && autocompactMode === 'disabled') {
    console.error(`[claude-hud:context] autocompactBuffer=disabled, showing raw ${rawPercent}% (buffered would be ${bufferedPercent}%)`);
  }

  const colors = ctx.config?.colors;
  const bar = coloredBar(percent, 10, colors);

  const parts: string[] = [];
  const display = ctx.config?.display;
  const contextValueMode = display?.contextValue ?? 'percent';
  const contextValue = formatContextValue(ctx, percent, contextValueMode);
  const contextValueDisplay = `${getContextColor(percent, colors)}${contextValue}${RESET}`;

  // Model and context bar (FIRST)
  const providerLabel = getProviderLabel(ctx.stdin);

  if (display?.showModel !== false && display?.showContextBar !== false) {
    parts.push(`${cyan(model)} ${bar} ${contextValueDisplay}`);
  } else if (display?.showModel !== false) {
    parts.push(`${cyan(model)} ${contextValueDisplay}`);
  } else if (display?.showContextBar !== false) {
    parts.push(`${bar} ${contextValueDisplay}`);
  } else {
    parts.push(contextValueDisplay);
  }

  // Project path + git status (SECOND)
  let projectPart: string | null = null;
  if (display?.showProject !== false && ctx.stdin.cwd) {
    // Split by both Unix (/) and Windows (\) separators for cross-platform support
    const segments = ctx.stdin.cwd.split(/[/\\]/).filter(Boolean);
    const pathLevels = ctx.config?.pathLevels ?? 1;
    // Always join with forward slash for consistent display
    // Handle root path (/) which results in empty segments
    const projectPath = segments.length > 0 ? segments.slice(-pathLevels).join('/') : '/';
    projectPart = yellow(projectPath);
  }

  let gitPart = '';
  const gitConfig = ctx.config?.gitStatus;
  const showGit = gitConfig?.enabled ?? true;

  if (showGit && ctx.gitStatus) {
    const gitParts: string[] = [ctx.gitStatus.branch];

    // Show dirty indicator
    if ((gitConfig?.showDirty ?? true) && ctx.gitStatus.isDirty) {
      gitParts.push('*');
    }

    // Show ahead/behind (with space separator for readability)
    if (gitConfig?.showAheadBehind) {
      if (ctx.gitStatus.ahead > 0) {
        gitParts.push(` ↑${ctx.gitStatus.ahead}`);
      }
      if (ctx.gitStatus.behind > 0) {
        gitParts.push(` ↓${ctx.gitStatus.behind}`);
      }
    }

    // Show file stats in Starship-compatible format (!modified +added ✘deleted ?untracked)
    if (gitConfig?.showFileStats && ctx.gitStatus.fileStats) {
      const { modified, added, deleted, untracked } = ctx.gitStatus.fileStats;
      const statParts: string[] = [];
      if (modified > 0) statParts.push(`!${modified}`);
      if (added > 0) statParts.push(`+${added}`);
      if (deleted > 0) statParts.push(`✘${deleted}`);
      if (untracked > 0) statParts.push(`?${untracked}`);
      if (statParts.length > 0) {
        gitParts.push(` ${statParts.join(' ')}`);
      }
    }

    gitPart = `${magenta('git:(')}${cyan(gitParts.join(''))}${magenta(')')}`;
  }

  if (projectPart && gitPart) {
    parts.push(`${projectPart} ${gitPart}`);
  } else if (projectPart) {
    parts.push(projectPart);
  } else if (gitPart) {
    parts.push(gitPart);
  }

  // Version (after git status)
  if (display?.showVersion !== false && ctx.stdin.version) {
    parts.push(cyan(`v${ctx.stdin.version}`));
  }

  // Session name (custom title from /rename, or auto-generated slug)
  if (display?.showSessionName && ctx.transcript.sessionName) {
    parts.push(dim(ctx.transcript.sessionName));
  }

  // Config counts (respects environmentThreshold)
  if (display?.showConfigCounts !== false) {
    const totalCounts = ctx.claudeMdCount + ctx.rulesCount + ctx.mcpCount + ctx.hooksCount;
    const envThreshold = display?.environmentThreshold ?? 0;

    if (totalCounts > 0 && totalCounts >= envThreshold) {
      if (ctx.claudeMdCount > 0) {
        parts.push(dim(`${ctx.claudeMdCount} CLAUDE.md`));
      }

      if (ctx.rulesCount > 0) {
        parts.push(dim(`${ctx.rulesCount} rules`));
      }

      if (ctx.mcpCount > 0) {
        parts.push(dim(`${ctx.mcpCount} MCPs`));
      }

      if (ctx.hooksCount > 0) {
        parts.push(dim(`${ctx.hooksCount} hooks`));
      }
    }
  }

  // Usage limits display (shown when enabled in config, respects usageThreshold)
  if (display?.showUsage !== false && ctx.usageData && !providerLabel) {
    const usageContent = formatUsageDisplay(ctx.usageData, display, colors);
    if (usageContent) {
      parts.push(usageContent);
    }
  }

  // Session duration
  if (display?.showSpeed) {
    const speed = getOutputSpeed(ctx.stdin);
    if (speed !== null) {
      parts.push(dim(`out: ${speed.toFixed(1)} tok/s`));
    }
  }

  if (display?.showDuration !== false && ctx.sessionDuration) {
    parts.push(dim(`⏱️  ${ctx.sessionDuration}`));
  }

  if (ctx.extraLabel) {
    parts.push(dim(ctx.extraLabel));
  }

  let line = parts.join(' | ');

  // Token breakdown at high context
  if (display?.showTokenBreakdown !== false && percent >= 85) {
    const usage = ctx.stdin.context_window?.current_usage;
    if (usage) {
      const input = formatTokens(usage.input_tokens ?? 0);
      const cache = formatTokens((usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0));
      line += dim(` (in: ${input}, cache: ${cache})`);
    }
  }

  return line;
}

function formatTokens(n: number): string {
  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(0)}k`;
  }
  return n.toString();
}

function formatContextValue(ctx: RenderContext, percent: number, mode: 'percent' | 'tokens' | 'remaining'): string {
  if (mode === 'tokens') {
    const totalTokens = getTotalTokens(ctx.stdin);
    const size = ctx.stdin.context_window?.context_window_size ?? 0;
    if (size > 0) {
      return `${formatTokens(totalTokens)}/${formatTokens(size)}`;
    }
    return formatTokens(totalTokens);
  }

  if (mode === 'remaining') {
    return `${Math.max(0, 100 - percent)}%`;
  }

  return `${percent}%`;
}
