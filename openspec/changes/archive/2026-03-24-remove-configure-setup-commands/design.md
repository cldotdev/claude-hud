## Context

The plugin currently ships two slash commands (`/claude-hud:setup` and `/claude-hud:configure`) defined as markdown files in `commands/`. These are registered in `.claude-plugin/plugin.json` via the `commands` array. Each command consumes context window tokens when loaded. The setup command alone is ~270 lines of detailed platform-specific instructions.

## Goals / Non-Goals

**Goals:**

- Remove both command files to eliminate their context window cost
- Clean up the plugin manifest to reflect no commands
- Update all documentation references (CLAUDE.md, README.md, CLAUDE.README.md)
- Clean up package.json and existing OpenSpec specs
- Record the breaking change in CHANGELOG.md

**Non-Goals:**

- Replacing the commands with alternative in-plugin configuration mechanisms
- Changing any runtime behavior of the HUD itself
- Modifying the config loading/parsing logic in `src/config.ts`

## Decisions

**Delete command files rather than making them smaller**: The goal is to save context entirely. Even a minimal command still consumes tokens on load. Full removal is the only way to achieve zero context cost.

**Keep config.json support**: The HUD still reads `~/.claude/plugins/claude-hud/config.json` for display options. Users can manually create/edit this file. No code changes needed.

**No migration tooling**: Users who previously used `/claude-hud:setup` already have their `statusLine` configured in `~/.claude/settings.json`. Removing the command doesn't break existing setups.

**Inline statusLine JSON in docs**: README.md and CLAUDE.README.md now include the full statusLine JSON snippet so users can copy-paste without needing the setup command. The duplication across files is acceptable since they serve different audiences (humans vs LLM agents).

## Risks / Trade-offs

- [New users lose guided setup] -> README and CLAUDE.README.md provide inline JSON config snippet for manual setup
- [No interactive configure flow] -> Config file format is documented; users edit JSON directly
