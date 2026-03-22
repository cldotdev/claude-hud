### Requirement: Usage display shows reset countdown without prefix

The usage display SHALL show the reset countdown time in parentheses directly after the percentage, without any `resets in` or `resets` prefix text.

#### Scenario: Normal usage with bar enabled
- **WHEN** 5-hour usage is 45% with reset time available and bar enabled
- **THEN** display SHALL render as `<bar> 45% (1h 30m)` (not `<bar> 45% (resets in 1h 30m)`)

#### Scenario: Normal usage with bar disabled
- **WHEN** 5-hour usage is 45% with reset time available and bar disabled
- **THEN** display SHALL render as `5h: 45% (1h 30m)` (not `5h: 45% (resets in 1h 30m)`)

#### Scenario: Seven-day usage with bar enabled
- **WHEN** 7-day usage exceeds threshold with reset time available and bar enabled
- **THEN** display SHALL render as `<bar> <percent> (<reset_time>)` without prefix

#### Scenario: Seven-day usage with bar disabled
- **WHEN** 7-day usage exceeds threshold with reset time available and bar disabled
- **THEN** display SHALL render as `7d: <percent> (<reset_time>)` without prefix

#### Scenario: Limit reached
- **WHEN** usage reaches 100%
- **THEN** display SHALL render as `⚠ Limit reached (<reset_time>)` (not `⚠ Limit reached (resets <reset_time>)`)

#### Scenario: No reset time available
- **WHEN** reset time is not available
- **THEN** display SHALL omit the parenthesized section entirely
