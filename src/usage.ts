import type { StdinData, UsageData } from './types.js';
import { roundPercent } from './stdin.js';

export function extractUsage(stdin: StdinData): UsageData | null {
  const rl = stdin.rate_limits;
  if (!rl) return null;

  const fiveHour = roundPercent(rl.five_hour?.used_percentage);
  const sevenDay = roundPercent(rl.seven_day?.used_percentage);

  if (fiveHour === null && sevenDay === null) return null;

  return {
    fiveHour,
    sevenDay,
    fiveHourResetAt: toDate(rl.five_hour?.resets_at),
    sevenDayResetAt: toDate(rl.seven_day?.resets_at),
  };
}

function toDate(timestamp?: number): Date | null {
  if (typeof timestamp !== 'number' || timestamp <= 0) return null;
  return new Date(timestamp * 1000);
}
