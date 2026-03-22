## Why

The usage bar currently shows `resets in` before the countdown timer (e.g., `45% (resets in 1h 30m)`). This is verbose for a statusline where space is precious. Removing the prefix yields a cleaner display while retaining the same information — the parenthesized time is self-explanatory.

## What Changes

- Remove `resets in` prefix from the 5-hour and 7-day usage displays
- Remove `resets` prefix from the limit-reached message
- Resulting format: `45% (1h 30m)` instead of `45% (resets in 1h 30m)`
- Limit-reached format: `⚠ Limit reached (1h 30m)` instead of `⚠ Limit reached (resets 1h 30m)`

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none — this is a cosmetic string change within existing rendering logic, no spec-level behavior changes)

## Impact

- `src/render/format.ts`: `formatUsageDisplay()` — 6 string template changes
- Tests covering usage display output strings will need updated expectations
