## Why

The `/claude-hud:setup` and `/claude-hud:configure` commands consume significant context window tokens every time they are loaded. Since context is a scarce resource, removing these commands frees up space for actual work. Setup and configuration can be handled through documentation or manual editing instead.

## What Changes

- **BREAKING**: Remove `commands/setup.md` — the `/claude-hud:setup` slash command will no longer be available
- **BREAKING**: Remove `commands/configure.md` — the `/claude-hud:configure` slash command will no longer be available
- Remove the `commands` array from `.claude-plugin/plugin.json`
- Update `CLAUDE.md`, `README.md`, and `CLAUDE.README.md` references to these commands
- Remove `"commands/"` from `package.json` `files` array
- Add breaking change entry to `CHANGELOG.md`
- Update `openspec/specs/adaptive-terminal-width/spec.md` to remove obsolete command requirements

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none — this is a removal with no spec-level behavior changes to existing capabilities)

## Impact

- **Plugin manifest**: `.claude-plugin/plugin.json` loses its `commands` field
- **Command files**: `commands/setup.md` and `commands/configure.md` are deleted
- **Package config**: `package.json` `files` array no longer includes `commands/`
- **Documentation**: `CLAUDE.md`, `README.md`, `CLAUDE.README.md` updated; `CHANGELOG.md` records breaking change
- **Specs**: `openspec/specs/adaptive-terminal-width/spec.md` updated to remove obsolete command requirements
- **Users**: Must manually configure `statusLine` in `~/.claude/settings.json` and `~/.claude/plugins/claude-hud/config.json` — guided setup is no longer available
