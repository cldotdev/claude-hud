import type { RenderContext } from '../types.js';
import type { UsageData } from '../types.js';
import { critical, dim, getQuotaColor, quotaBar, RESET } from './colors.js';
import { getAdaptiveBarWidth } from '../utils/terminal.js';

export function formatUsagePercent(percent: number | null, colors?: RenderContext['config']['colors']): string {
  if (percent === null) {
    return dim('--');
  }
  const color = getQuotaColor(percent, colors);
  return `${color}${percent}%${RESET}`;
}

/**
 * Format usage data into a display string.
 * Returns null if below threshold or no data.
 * Used by both compact (session-line) and expanded (usage line) modes.
 */
export function formatUsageDisplay(
  usageData: UsageData,
  display: RenderContext['config']['display'],
  colors: RenderContext['config']['colors'],
): string | null {
  const { fiveHour, sevenDay, fiveHourResetAt, sevenDayResetAt } = usageData;

  if (fiveHour === 100 || sevenDay === 100) {
    const resetTime = fiveHour === 100
      ? formatResetTime(fiveHourResetAt)
      : formatResetTime(sevenDayResetAt);
    return critical(`⚠ Limit reached${resetTime ? ` (${resetTime})` : ''}`, colors);
  }

  const threshold = display?.usageThreshold ?? 0;
  const effectiveUsage = Math.max(fiveHour ?? 0, sevenDay ?? 0);
  if (effectiveUsage < threshold) {
    return null;
  }

  const fiveHourDisplay = formatUsagePercent(fiveHour, colors);
  const fiveHourReset = formatResetTime(fiveHourResetAt);
  const usageBarEnabled = display?.usageBarEnabled ?? true;
  const barWidth = getAdaptiveBarWidth();

  const fiveHourPart = usageBarEnabled
    ? (fiveHourReset
        ? `${quotaBar(fiveHour ?? 0, barWidth, colors)} ${fiveHourDisplay} (${fiveHourReset})`
        : `${quotaBar(fiveHour ?? 0, barWidth, colors)} ${fiveHourDisplay}`)
    : (fiveHourReset
        ? `5h: ${fiveHourDisplay} (${fiveHourReset})`
        : `5h: ${fiveHourDisplay}`);

  const sevenDayThreshold = display?.sevenDayThreshold ?? 80;
  if (sevenDay !== null && sevenDay >= sevenDayThreshold) {
    const sevenDayDisplay = formatUsagePercent(sevenDay, colors);
    const sevenDayReset = formatResetTime(sevenDayResetAt);
    const sevenDayPart = usageBarEnabled
      ? (sevenDayReset
          ? `${quotaBar(sevenDay, barWidth, colors)} ${sevenDayDisplay} (${sevenDayReset})`
          : `${quotaBar(sevenDay, barWidth, colors)} ${sevenDayDisplay}`)
      : (sevenDayReset
          ? `7d: ${sevenDayDisplay} (${sevenDayReset})`
          : `7d: ${sevenDayDisplay}`);
    return `${fiveHourPart} | ${sevenDayPart}`;
  }

  return fiveHourPart;
}

export function formatResetTime(resetAt: Date | null): string {
  if (!resetAt) return '';
  const now = new Date();
  const diffMs = resetAt.getTime() - now.getTime();
  if (diffMs <= 0) return '';

  const diffMins = Math.ceil(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m`;

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    if (remHours > 0) return `${days}d ${remHours}h`;
    return `${days}d`;
  }

  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
