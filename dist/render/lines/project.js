import { getModelName } from '../../stdin.js';
import { cyan, dim, magenta, yellow } from '../colors.js';
export function renderProjectLine(ctx) {
    const display = ctx.config?.display;
    const parts = [];
    if (display?.showModel !== false) {
        const model = getModelName(ctx.stdin);
        parts.push(cyan(model));
    }
    let projectPart = null;
    if (display?.showProject !== false && ctx.stdin.cwd) {
        const segments = ctx.stdin.cwd.split(/[/\\]/).filter(Boolean);
        const pathLevels = ctx.config?.pathLevels ?? 1;
        const projectPath = segments.length > 0 ? segments.slice(-pathLevels).join('/') : '/';
        projectPart = yellow(projectPath);
    }
    let gitPart = '';
    const gitConfig = ctx.config?.gitStatus;
    const showGit = gitConfig?.enabled ?? true;
    if (showGit && ctx.gitStatus) {
        const gitParts = [ctx.gitStatus.branch];
        if ((gitConfig?.showDirty ?? true) && ctx.gitStatus.isDirty) {
            gitParts.push('*');
        }
        if (gitConfig?.showAheadBehind) {
            if (ctx.gitStatus.ahead > 0) {
                gitParts.push(` ↑${ctx.gitStatus.ahead}`);
            }
            if (ctx.gitStatus.behind > 0) {
                gitParts.push(` ↓${ctx.gitStatus.behind}`);
            }
        }
        if (gitConfig?.showFileStats && ctx.gitStatus.fileStats) {
            const { modified, added, deleted, untracked } = ctx.gitStatus.fileStats;
            const statParts = [];
            if (modified > 0)
                statParts.push(`!${modified}`);
            if (added > 0)
                statParts.push(`+${added}`);
            if (deleted > 0)
                statParts.push(`✘${deleted}`);
            if (untracked > 0)
                statParts.push(`?${untracked}`);
            if (statParts.length > 0) {
                gitParts.push(` ${statParts.join(' ')}`);
            }
        }
        gitPart = `${magenta('git:(')}${cyan(gitParts.join(''))}${magenta(')')}`;
    }
    if (projectPart && gitPart) {
        parts.push(`${projectPart} ${gitPart}`);
    }
    else if (projectPart) {
        parts.push(projectPart);
    }
    else if (gitPart) {
        parts.push(gitPart);
    }
    if (display?.showVersion !== false && ctx.stdin.version) {
        parts.push(cyan(`v${ctx.stdin.version}`));
    }
    if (display?.showSessionName && ctx.transcript.sessionName) {
        parts.push(dim(ctx.transcript.sessionName));
    }
    if (parts.length === 0) {
        return null;
    }
    return parts.join(' \u2502 ');
}
//# sourceMappingURL=project.js.map