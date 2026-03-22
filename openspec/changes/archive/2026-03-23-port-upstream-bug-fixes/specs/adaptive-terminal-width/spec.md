## ADDED Requirements

### Requirement: Terminal width detection via stderr fallback
The system SHALL fall back to `process.stderr.columns` when `process.stdout.columns` is unavailable (e.g., when stdout is piped). This MUST be checked before the `COLUMNS` environment variable fallback.

#### Scenario: stdout is piped, stderr is connected to TTY
- **WHEN** the statusline runs as a subprocess with stdout piped but stderr connected to the terminal
- **THEN** `getTerminalWidth()` SHALL return the width from `process.stderr.columns`

#### Scenario: both stdout and stderr are piped
- **WHEN** both `process.stdout.columns` and `process.stderr.columns` are unavailable
- **THEN** `getTerminalWidth()` SHALL fall back to the `COLUMNS` environment variable

### Requirement: Adaptive progress bar width
The system SHALL scale progress bar width based on the detected terminal width: 10 characters for wide terminals (>=100 cols), 6 for medium (60-99 cols), 4 for narrow (<60 cols), defaulting to 10 when width is unknown.

#### Scenario: Wide terminal
- **WHEN** terminal width is 100 columns or more
- **THEN** progress bars SHALL render with width 10

#### Scenario: Medium terminal
- **WHEN** terminal width is between 60 and 99 columns
- **THEN** progress bars SHALL render with width 6

#### Scenario: Narrow terminal
- **WHEN** terminal width is less than 60 columns
- **THEN** progress bars SHALL render with width 4

#### Scenario: Unknown terminal width
- **WHEN** terminal width cannot be determined
- **THEN** progress bars SHALL render with default width 10

### Requirement: Expanded layout showSpeed and showDuration
The system SHALL render `showSpeed` and `showDuration` in the expanded layout's project line, matching their existing behavior in compact mode.

#### Scenario: showSpeed enabled in expanded layout
- **WHEN** `display.showSpeed` is true and layout is expanded
- **THEN** the project line SHALL include output token speed (e.g., `out: 42.0 tok/s`)

#### Scenario: showDuration in expanded layout
- **WHEN** `display.showDuration` is not false and layout is expanded
- **THEN** the project line SHALL include session duration

### Requirement: Expanded layout extraLabel
The system SHALL render `extraLabel` in the expanded layout's project line, matching compact mode behavior.

#### Scenario: extraLabel present in expanded layout
- **WHEN** `ctx.extraLabel` is set and layout is expanded
- **THEN** the project line SHALL include the extra label

### Requirement: Usage time format clarity
The system SHALL display usage reset time as `(resets in Xh Ym)` instead of `(Xh Ym / 5h)` or `(Xh Ym / 7d)`.

#### Scenario: Five-hour usage with reset time
- **WHEN** five-hour usage data includes a reset timestamp and bars are enabled
- **THEN** the display SHALL show `(resets in 2h 43m)` format, not `(2h 43m / 5h)`

#### Scenario: Seven-day usage with reset time
- **WHEN** seven-day usage data includes a reset timestamp and bars are enabled
- **THEN** the display SHALL show `(resets in 5d 2h)` format, not `(5d 2h / 7d)`

#### Scenario: Text-only mode reset time
- **WHEN** usage bars are disabled and reset time is available
- **THEN** the display SHALL show `(resets in Xh Ym)` format

### Requirement: macOS restart hint
The system SHALL display a macOS-specific hint when the HUD initializes without stdin data.

#### Scenario: No stdin on macOS
- **WHEN** the HUD initializes without stdin and the platform is macOS (darwin)
- **THEN** the output SHALL include a note about restarting Claude Code

### Requirement: CLAUDE_CONFIG_DIR support in setup
The setup command SHALL respect the `CLAUDE_CONFIG_DIR` environment variable when locating the plugin cache, registry, and settings files.

#### Scenario: Custom config directory
- **WHEN** `CLAUDE_CONFIG_DIR` is set to a non-default path
- **THEN** setup SHALL use that path instead of `~/.claude`

#### Scenario: Default config directory
- **WHEN** `CLAUDE_CONFIG_DIR` is not set
- **THEN** setup SHALL use `$HOME/.claude` as default

### Requirement: Plugin command registration
The plugin manifest SHALL declare its command files so Claude Code can resolve skill invocations. The package.json SHALL declare included files for proper npm packaging.

#### Scenario: Plugin commands discoverable
- **WHEN** Claude Code looks up plugin commands
- **THEN** plugin.json SHALL list `./commands/setup.md` and `./commands/configure.md`

#### Scenario: Package includes necessary files
- **WHEN** the package is distributed via npm
- **THEN** package.json SHALL include `dist/`, `src/`, `commands/`, and `.claude-plugin/` in the files array
