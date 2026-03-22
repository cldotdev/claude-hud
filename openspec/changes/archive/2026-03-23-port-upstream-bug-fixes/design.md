## Context

The project is a fork of jarrodwatts/claude-hud. The upstream repo has received 8 bug-fix PRs from community contributors. These fixes address real issues users encounter: terminal scrolling glitches (#209), progress bar overflow (#231), missing features in expanded layout (#221, #242), ambiguous time display (#240), setup failures with custom config dirs (#247), and plugin packaging errors (#222).

All fixes are small, well-scoped patches. We are porting them as a batch to keep our fork in sync.

## Goals / Non-Goals

**Goals:**

- Port all 8 upstream bug fixes to maintain parity with upstream
- Preserve the existing behavior and code style of our fork
- Add the new `src/utils/terminal.ts` shared utility for adaptive bar width

**Non-Goals:**

- Porting upstream feature additions (256-color support #236, customLine #223) -- those are separate changes
- Refactoring beyond what the upstream patches require
- Adding new tests beyond what upstream provides (tests will be ported with their fixes)

## Decisions

- **Batch port vs cherry-pick**: Port all 8 fixes as a single change since they are all small, independent bug fixes. This avoids 8 separate branches/PRs for trivial patches.
- **stderr fallback placement**: Add `process.stderr.columns` check in `getTerminalWidth()` (render/index.ts) between the existing stdout check and the COLUMNS env var check, matching upstream ordering.
- **getAdaptiveBarWidth in new utility file**: Create `src/utils/terminal.ts` as upstream does, rather than inlining the logic. This keeps the bar width logic DRY across 3 render files. The upstream version uses `process.stdout.columns` but our `getTerminalWidth()` already handles stderr fallback -- the adaptive bar width utility should also use stderr fallback for consistency.
- **Usage format wording**: The upstream uses `(resets in ${time})` for both bar-enabled and text-only modes. Our codebase has extracted usage formatting into `src/render/format.ts`, so the wording change goes there instead of the per-layout files.
- **barWidth caching in formatUsageDisplay**: The `/simplify` review identified that `getAdaptiveBarWidth()` was called up to 4 times per `formatUsageDisplay()` invocation. Cached the result in a local `barWidth` variable to avoid redundant process.stdout/stderr access on the ~300ms render hot path.

## Risks / Trade-offs

- **getAdaptiveBarWidth stdout vs stderr**: The upstream `getAdaptiveBarWidth()` only checks `process.stdout.columns`, which is null when piped. Since the scrolling fix adds stderr fallback to `getTerminalWidth()`, the adaptive bar width should also use stderr. We'll enhance it to match. Risk: minimal, both return same value when stdout is available. Mitigation: use the same fallback chain.
- **setup.md CLAUDE_CONFIG_DIR**: The change uses shell variable expansion `${CLAUDE_CONFIG_DIR:-$HOME/.claude}` which only works in bash. The PowerShell section is unaffected. Risk: none, bash-only paths already assume bash.
