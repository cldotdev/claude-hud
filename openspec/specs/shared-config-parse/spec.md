## ADDED Requirements

### Requirement: Each config file is read at most once per invocation
The `countConfigs` function SHALL read and parse each filesystem path at most once. Subsequent accesses to the same path SHALL use the cached parsed result.

#### Scenario: Settings file used by multiple helpers
- **WHEN** `countConfigs` needs MCP servers, disabled MCPs, and hooks from the same `settings.json` file
- **THEN** the file SHALL be read from disk exactly once and the parsed JSON SHALL be reused for all three lookups

#### Scenario: File does not exist
- **WHEN** a config file path does not exist on disk
- **THEN** `readFileSync` SHALL catch ENOENT (no pre-check with `existsSync`), the non-existence SHALL be cached as null, and no further reads SHALL be attempted for that path

### Requirement: Identical output to previous implementation
The refactored config reader SHALL return the same `ConfigCounts` values as the previous implementation for any given filesystem state.

#### Scenario: Result parity
- **WHEN** `countConfigs` is called with a cwd containing user and project config files
- **THEN** the returned `claudeMdCount`, `rulesCount`, `mcpCount`, and `hooksCount` SHALL match the values the previous implementation would return
