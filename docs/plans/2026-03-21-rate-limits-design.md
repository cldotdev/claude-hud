# Replace OAuth Usage API with stdin rate_limits

## Context

Claude Code v2.1.80 introduced a `rate_limits` field in statusline stdin JSON input. This provides the same usage data (5-hour and 7-day windows) that we currently fetch via OAuth API calls to `api.anthropic.com/api/oauth/usage`. The stdin approach is simpler, faster, and more accurate since it comes directly from Claude Code's internal state.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Plan name display | Remove entirely | Show only model name in bracket, e.g. `[Opus]` instead of `[Opus \| Max]` |
| Backward compat | None | If `rate_limits` absent, usage line simply not shown |
| Config `usage` section | Remove silently | OAuth cache params no longer needed; stale config ignored |
| Percent rounding | `Math.round()` | Consistent with existing `getNativePercent` in stdin.ts |
| Render simplification | Remove OAuth-specific UI | Drop `syncing...`, `apiUnavailable`, `apiError` states |
| Type refactoring | Clean `UsageData` | Remove `planName`, `apiUnavailable`, `apiError` fields |

## Data Source

### stdin `rate_limits` structure

```json
{
  "rate_limits": {
    "five_hour": {
      "used_percentage": 45.000000000000001,
      "resets_at": 1711123456
    },
    "seven_day": {
      "used_percentage": 62,
      "resets_at": 1711299456
    }
  }
}
```

- `used_percentage`: float 0-100, needs `Math.round()` before use
- `resets_at`: Unix timestamp in seconds (not ISO 8601)
- Field is `null`/absent until first model response in a session
- Only present for Claude.ai subscribers, not API-key users

## Architecture

### Approach: New `src/usage.ts` module (replaces `src/usage-api.ts`)

A ~20-line pure function module that extracts and normalizes `rate_limits` from stdin.

### Files to delete

- `src/usage-api.ts` (1,090 lines) — OAuth credentials, HTTP client, file cache, keychain, retry logic
- Corresponding test files for usage-api

### Files to create

- `src/usage.ts` — `extractUsage(stdin: StdinData): UsageData | null`

### Files to modify

**`src/types.ts`**
- Add `rate_limits` to `StdinData`
- Simplify `UsageData`: remove `planName`, `apiUnavailable`, `apiError`
- Remove `UsageWindow` interface
- Remove `isLimitReached` function

**`src/index.ts`**
- Replace `import { getUsage } from './usage-api.js'` with `import { extractUsage } from './usage.js'`
- Change `await deps.getUsage(...)` to synchronous `extractUsage(stdin)`
- Update `MainDeps` type

**`src/config.ts`**
- Remove `usage` section from `HudConfig` and `DEFAULT_CONFIG`
- Remove `cacheTtlSeconds` / `failureCacheTtlSeconds` validation

**`src/render/lines/usage.ts`**
- Remove `planName` check (use `!ctx.usageData` instead)
- Remove `apiUnavailable` / `apiError` / `syncing...` handling
- Remove `formatUsageError` function
- Inline limit-reached check (`fiveHour === 100 || sevenDay === 100`)

**`src/render/lines/project.ts`**
- Remove plan name from bracket display

### Data flow

```
Before:  stdin → index.ts → getUsage() → OAuth API → cache → UsageData → render
After:   stdin (with rate_limits) → index.ts → extractUsage(stdin) → UsageData → render
```

## Render behavior

### Preserved

- Progress bar with `quotaBar()`
- Color thresholds via `getQuotaColor()`
- `usageThreshold` gate (hide below N%)
- `sevenDayThreshold` conditional 7-day display
- `usageBarEnabled` toggle
- Limit reached display with reset time
- `formatResetTime` helper

### Removed

- `⚠ (error-hint)` for API unavailable
- `(syncing...)` suffix for rate-limited state
- `formatUsageError` function
