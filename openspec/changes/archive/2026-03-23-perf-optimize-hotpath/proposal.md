## Why

The HUD statusline process is invoked every ~300ms. Profiling reveals multiple hot-path bottlenecks: sequential I/O that should be parallel, redundant file reads, O(n^2) string operations in ANSI rendering, multiple git subprocesses that could be one, and full-file transcript re-parsing on every tick. Together these push per-invocation latency well above what is acceptable for a 300ms cadence.

## What Changes

- Parallelize independent async I/O in the main entry point (`parseTranscript`, `countConfigs`, `loadConfig`, `getGitStatus`) with `Promise.all`.
- Replace three sequential git subprocess calls with a single `git status -b --porcelain=v2`.
- Refactor config-reader helpers to read and parse each file at most once per invocation, sharing the parsed object.
- Rewrite `splitAnsiTokens`, `sliceVisible`, and `splitLineBySeparators` to avoid O(n^2) `str.slice(i)` allocations; use sticky/global regex instead.
- Optimize transcript parsing: reverse-read strategy for large files, skip `new Date()` construction for lines that don't need timestamps.

## Capabilities

### New Capabilities

- `parallel-io`: Concurrent execution of independent I/O operations in the main entry point.
- `single-git-command`: Unified git status retrieval via a single `git status -b --porcelain=v2` invocation.
- `shared-config-parse`: Read-once, share-many pattern for config file access.
- `efficient-ansi-render`: O(n) ANSI token splitting and visible-width computation using sticky/global regex.
- `optimized-transcript`: Tail-read and lazy-timestamp strategy for transcript JSONL parsing.

### Modified Capabilities

(none - these are internal implementation changes with no spec-level behavior change)

## Impact

- **Files**: `src/index.ts`, `src/git.ts`, `src/config-reader.ts`, `src/render/index.ts`, `src/transcript.ts`
- **APIs**: No external API changes. All changes are internal implementation.
- **Dependencies**: No new dependencies.
- **Risk**: Git porcelain v2 output format differs from v1; parser must handle the new format correctly. Parallel I/O changes error handling semantics (fail-fast vs independent).
