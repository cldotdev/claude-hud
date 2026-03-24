## REMOVED Requirements

### Requirement: Setup command
**Reason**: Consumes excessive context window tokens (~270 lines). Users can configure manually via documentation.
**Migration**: Manually add `statusLine` config to `~/.claude/settings.json` following README instructions.

### Requirement: Configure command
**Reason**: Consumes context window tokens for guided configuration flow. Users can edit config.json directly.
**Migration**: Manually edit `~/.claude/plugins/claude-hud/config.json` for display options.

### Requirement: Plugin command registration
**Reason**: No commands remain to register after removing setup and configure.
**Migration**: The `commands` field is removed from `.claude-plugin/plugin.json`. No user action needed.
