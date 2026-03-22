## ADDED Requirements

### Requirement: Truly async I/O operations execute concurrently
The main entry point SHALL execute `parseTranscript`, `getGitStatus`, and `runExtraCmd` concurrently using `Promise.all` after synchronous setup (`loadConfig`, `countConfigs`) completes. `countConfigs` runs before `Promise.all` because it performs only sync filesystem I/O and would block the event loop without yielding.

#### Scenario: Parallel execution reduces wall-clock time
- **WHEN** the HUD process starts with valid stdin containing a transcript path and cwd
- **THEN** `parseTranscript`, `getGitStatus`, and `runExtraCmd` SHALL begin execution without waiting for each other to complete

#### Scenario: Individual failure does not block other operations
- **WHEN** one of the parallel operations throws an error (e.g., transcript file missing)
- **THEN** the other operations SHALL complete normally and the failing operation SHALL return its safe default value

### Requirement: Config-dependent operations respect config flags
The system SHALL read config before dispatching parallel work so that `getGitStatus` is only called when `config.gitStatus.enabled` is true.

#### Scenario: Git disabled in config
- **WHEN** `config.gitStatus.enabled` is false
- **THEN** `getGitStatus` SHALL NOT be called and `gitStatus` SHALL be null

#### Scenario: Git enabled in config
- **WHEN** `config.gitStatus.enabled` is true
- **THEN** `getGitStatus` SHALL run concurrently with `parseTranscript` and `runExtraCmd`
