## ADDED Requirements

### Requirement: ANSI token splitting in O(n) time
The `splitAnsiTokens` function SHALL split a string into ANSI escape and text tokens in a single pass without creating intermediate substring copies via `str.slice(i)`.

#### Scenario: String with interleaved ANSI codes and text
- **WHEN** given a string containing ANSI escape sequences mixed with plain text
- **THEN** the function SHALL return the same token sequence as the previous implementation

#### Scenario: String with no ANSI codes
- **WHEN** given a plain text string with no escape sequences
- **THEN** the function SHALL return a single text token containing the entire string

### Requirement: Visual length computation without double scanning
The `truncateToWidth` function SHALL avoid computing `visualLength` separately before calling `sliceVisible`. Width checking and slicing SHALL be combined into a single pass where possible.

#### Scenario: String within width limit
- **WHEN** the string's visual width is less than or equal to `maxWidth`
- **THEN** the string SHALL be returned unmodified without a second scan

#### Scenario: String exceeding width limit
- **WHEN** the string's visual width exceeds `maxWidth`
- **THEN** the string SHALL be truncated with an ellipsis suffix in a single scanning pass

### Requirement: Separator detection without substring allocation
The `splitLineBySeparators` function SHALL detect separator patterns (` | ` and ` \u2502 `) without using `str.slice(i)` for ANSI skipping.

#### Scenario: Line with multiple separators
- **WHEN** a line contains ANSI-styled segments separated by ` | ` or ` \u2502 `
- **THEN** the function SHALL return the same segments and separators as the previous implementation
