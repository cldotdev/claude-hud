## Why

The upstream repo (jarrodwatts/claude-hud) has accumulated 8 community bug fixes since our last sync. These fix real user-facing issues: terminal scrolling glitches, progress bar overflow in narrow terminals, missing features in expanded layout, ambiguous time formats, and plugin packaging problems that prevent setup from working.

## What Changes

- Add stderr fallback for terminal width detection (fixes terminal scrolling to top on tool execution)
- Add adaptive progress bar width based on terminal columns (fixes line wrapping in narrow terminals)
- Render showSpeed and showDuration in expanded layout (were only working in compact mode)
- Render extraLabel in expanded layout (was only shown in compact mode)
- Change usage time format from `(2h 43m / 5h)` to `(resets in 2h 43m)` for clarity
- Add macOS restart hint when HUD initializes without stdin
- Respect CLAUDE_CONFIG_DIR env var in setup command (instead of hardcoding ~/.claude)
- Add `commands` field to plugin.json and `files` field to package.json (fixes unknown skill error)

## Capabilities

### New Capabilities

- `adaptive-terminal-width`: Terminal width detection via stderr fallback and adaptive progress bar scaling based on terminal columns

### Modified Capabilities

## Impact

- `src/render/index.ts` - stderr columns fallback in getTerminalWidth
- `src/render/lines/project.ts` - showSpeed, showDuration, extraLabel in expanded layout
- `src/render/lines/identity.ts` - adaptive bar width
- `src/render/format.ts` - adaptive bar width (cached per call), "resets in" wording
- `src/render/session-line.ts` - adaptive bar width
- `tests/render.test.js` - updated 3 assertions for "resets in" format
- `src/index.ts` - macOS restart hint
- `src/utils/terminal.ts` - new file: getAdaptiveBarWidth utility
- `commands/setup.md` - CLAUDE_CONFIG_DIR support
- `.claude-plugin/plugin.json` - commands field
- `package.json` - files field
