## ADDED Requirements

### Requirement: Lazy timestamp construction
The transcript parser SHALL only construct `Date` objects for the first entry (session start) and for entries containing `tool_use` or `tool_result` content blocks.

#### Scenario: Historical entry without tool blocks
- **WHEN** a transcript line has a timestamp but no `tool_use` or `tool_result` content blocks
- **THEN** no `Date` object SHALL be constructed for that line

#### Scenario: Entry with tool_use block
- **WHEN** a transcript line contains a `tool_use` content block
- **THEN** a `Date` object SHALL be constructed and assigned to the tool entry's `startTime`

### Requirement: Tail-read optimization for large transcripts
When the transcript file exceeds a size threshold (256KB), the parser SHALL read only the tail portion (last 64KB) for tool and agent activity, plus the first line for session start.

#### Scenario: Small transcript file
- **WHEN** the transcript file is smaller than 256KB
- **THEN** the parser SHALL read the entire file as before

#### Scenario: Large transcript file
- **WHEN** the transcript file exceeds 256KB
- **THEN** the parser SHALL read only the first line and the last 64KB of the file

#### Scenario: Session start from large file
- **WHEN** reading a large transcript file with tail optimization
- **THEN** `sessionStart` SHALL still reflect the timestamp of the first entry in the file

### Requirement: Identical output for recent activity
The optimized parser SHALL return the same `tools`, `agents`, and `todos` arrays as the full parser for all tool activity within the tail window.

#### Scenario: All recent tools in tail window
- **WHEN** all active and recently completed tools fall within the tail window
- **THEN** the returned `TranscriptData` SHALL be identical to a full-file parse
