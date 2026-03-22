## ADDED Requirements

### Requirement: Single git subprocess for all status data
The system SHALL retrieve branch name, dirty state, file stats, and ahead/behind counts from a single `git status -b --porcelain=v2` invocation.

#### Scenario: Normal repository with upstream
- **WHEN** the working directory is a git repository with an upstream-tracking branch
- **THEN** the system SHALL invoke exactly one `git` subprocess and return branch name, isDirty, fileStats, ahead, and behind values

#### Scenario: Repository without upstream
- **WHEN** the repository has no upstream configured
- **THEN** the system SHALL return branch name and dirty state with ahead=0 and behind=0

#### Scenario: Detached HEAD
- **WHEN** the repository is in detached HEAD state
- **THEN** the system SHALL return the abbreviated commit SHA as the branch name

### Requirement: Porcelain v2 file stats parsing
The system SHALL parse porcelain v2 changed entries (prefixed with `1`, `2`, `u`, `?`) to compute modified, added, deleted, and untracked file counts.

#### Scenario: Mixed file changes
- **WHEN** porcelain v2 output contains modified, added, deleted, and untracked entries
- **THEN** the returned `fileStats` SHALL accurately count each category

#### Scenario: Clean working tree
- **WHEN** no changed entries appear in the output
- **THEN** `isDirty` SHALL be false and `fileStats` SHALL be undefined

### Requirement: Fallback on old git versions
The system SHALL fall back to the previous multi-command approach if `git status -b --porcelain=v2` fails.

#### Scenario: Git version below 2.11
- **WHEN** `git status -b --porcelain=v2` exits with an error
- **THEN** the system SHALL attempt the legacy three-command approach and return valid results
