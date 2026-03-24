## 1. Remove Command Files

- [x] 1.1 Delete `commands/setup.md`
- [x] 1.2 Delete `commands/configure.md`
- [x] 1.3 Remove the `commands` directory if empty

## 2. Update Plugin Manifest

- [x] 2.1 Remove the `commands` array from `.claude-plugin/plugin.json`

## 3. Update Documentation

- [x] 3.1 Update `CLAUDE.md` — remove references to `/claude-hud:setup` and `/claude-hud:configure`
- [x] 3.2 Update `README.md` — replace setup/configure commands with inline JSON config snippet
- [x] 3.3 Update `CLAUDE.README.md` — replace setup command with inline JSON config snippet

## 4. Cleanup (ad-hoc from simplify pass)

- [x] 4.1 Remove `"commands/"` from `package.json` `files` array
- [x] 4.2 Remove obsolete command requirements from `openspec/specs/adaptive-terminal-width/spec.md`
- [x] 4.3 Add breaking change entry to `CHANGELOG.md` `[Unreleased]` section
