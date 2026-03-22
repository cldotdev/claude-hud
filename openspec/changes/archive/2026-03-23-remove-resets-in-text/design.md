## Context

The usage bar in `src/render/format.ts` displays reset countdowns with a `resets in` / `resets` prefix. This is the only file that needs modification — it contains all six occurrences of the prefix text across three display scenarios (5-hour with bar, 5-hour without bar, 7-day with bar, 7-day without bar, and limit-reached).

## Goals / Non-Goals

**Goals:**

- Remove `resets in` and `resets` prefixes from all usage display strings
- Update test expectations to match the new format

**Non-Goals:**

- Changing the time format itself (`1h 30m`, `45m`, etc.)
- Changing the parentheses wrapping or overall layout
- Modifying the `formatResetTime()` function

## Decisions

**Inline string edits only** — No structural refactoring. The change is 5 string template modifications in `formatUsageDisplay()`:

| Line | Before | After |
|------|--------|-------|
| 30 | `resets ${resetTime}` | `${resetTime}` |
| 46 | `(resets in ${fiveHourReset})` | `(${fiveHourReset})` |
| 49 | `(resets in ${fiveHourReset})` | `(${fiveHourReset})` |
| 58 | `(resets in ${sevenDayReset})` | `(${sevenDayReset})` |
| 61 | `(resets in ${sevenDayReset})` | `(${sevenDayReset})` |

## Risks / Trade-offs

- [Ambiguity] The parenthesized time without label may be less obvious to new users → Acceptable trade-off for statusline brevity; the context (next to a percentage) makes it clear.
