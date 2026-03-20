import type { RenderContext } from '../../types.js';
import { getProviderLabel } from '../../stdin.js';
import { formatUsageDisplay } from '../format.js';
import { cyan } from '../colors.js';

export function renderUsageLine(ctx: RenderContext): string | null {
  const display = ctx.config?.display;
  const colors = ctx.config?.colors;

  if (display?.showUsage === false) {
    return null;
  }

  if (!ctx.usageData) {
    return null;
  }

  if (getProviderLabel(ctx.stdin)) {
    return null;
  }

  const content = formatUsageDisplay(ctx.usageData, display, colors);
  if (!content) {
    return null;
  }

  return `${cyan('Usage')} ${content}`;
}
