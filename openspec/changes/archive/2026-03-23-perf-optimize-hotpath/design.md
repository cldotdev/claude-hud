## Context

Claude HUD is a statusline plugin invoked as a short-lived process every ~300ms. Each invocation reads stdin JSON, parses the session transcript JSONL, reads config files, queries git, renders ANSI output, and exits. Because the process is ephemeral (no persistent state between invocations), every operation runs from scratch each tick. Current implementation serializes all I/O and contains several algorithmic inefficiencies that compound under load.

Key source files: `src/index.ts` (orchestrator), `src/git.ts` (3 subprocesses), `src/config-reader.ts` (~29 sync fs calls), `src/render/index.ts` (O(n^2) ANSI parsing), `src/transcript.ts` (full-file sequential parse).

## Goals / Non-Goals

**Goals:**

- Reduce per-invocation wall-clock time by parallelizing independent I/O.
- Eliminate redundant filesystem operations in config reading.
- Replace multiple git subprocesses with a single command.
- Fix O(n^2) string allocation in ANSI rendering utilities.
- Reduce transcript parsing cost for large session files.
- Maintain identical output behavior (no user-visible changes).

**Non-Goals:**

- Cross-invocation caching (would require persistent daemon architecture).
- Changing the invocation model (still a short-lived process per tick).
- Adding new HUD features or display elements.
- Optimizing the TypeScript build or startup time.

## Decisions

### Parallel I/O orchestration (index.ts)

**Decision**: Run `loadConfig` and `countConfigs` sequentially first (both are fast sync I/O), then use `Promise.all` to run `parseTranscript`, `getGitStatus`, and `runExtraCmd` concurrently.

**Rationale**: `loadConfig` must complete first because `config.gitStatus.enabled` determines whether `getGitStatus` runs. `countConfigs` was initially planned for `Promise.all` but moved out because it performs only synchronous filesystem I/O — placing it in `Promise.all` gives no parallelism benefit and misleads readers about its async nature. The truly async operations (subprocess spawns, file streaming) benefit from concurrent execution.

**Alternative considered**: `Promise.allSettled` for fault isolation. Rejected because each parallel branch already has its own `.catch()` returning safe defaults, so `Promise.all` is equivalent and simpler.

### Single git command (git.ts)

**Decision**: Replace `rev-parse --abbrev-ref HEAD` + `status --porcelain` + `rev-list --left-right --count` with a single `git status -b --porcelain=v2`.

**Rationale**: Porcelain v2 output includes branch name, upstream tracking (ahead/behind), and per-file status in one invocation. Eliminates 2 subprocess spawns.

**Format**: Lines starting with `# branch.` provide metadata:
```
# branch.oid <sha>
# branch.head <branch>
# branch.upstream <upstream>
# branch.ab +<ahead> -<behind>
```
Changed/untracked files use `1`, `2`, `u`, `?` prefixes with structured columns.

**Alternative considered**: `git status --porcelain` (v1) + `--branch`. Rejected because v1 `--branch` output is less structured (requires regex parsing of `## branch...tracking`).

**Fallback**: If `git status -b --porcelain=v2` fails (git < 2.11), fall back to current three-command approach. Git 2.11 was released in 2016, so this is a reasonable baseline.

### Shared config parse (config-reader.ts)

**Decision**: Introduce a `readJsonFile(path)` helper with a per-invocation Map cache. Each unique file path is read and parsed at most once. All helper functions (`getMcpServerNames`, `getDisabledMcpServers`, `countHooksInFile`) receive the parsed object instead of a file path.

**Rationale**: Current code reads `settings.json` up to 3 times and `settings.local.json` up to 3 times per invocation. A simple in-memory cache eliminates ~20 redundant `fs.readFileSync` + `fs.existsSync` calls.

**Alternative considered**: Async file reads. Rejected because these are small JSON files (<10KB) and the overhead of async scheduling would exceed the read time. Sync is appropriate here.

**TOCTOU fix**: The original `existsSync` + `readFileSync` pattern was replaced with direct `readFileSync` catching ENOENT. This eliminates a redundant syscall per file and avoids the time-of-check/time-of-use race.

### Efficient ANSI rendering (render/index.ts)

**Decision**: Replace `str.slice(i)` + `ANSI_ESCAPE_PATTERN.exec()` loops with a single-pass global regex using `matchAll` or a sticky (`/y`) regex with `lastIndex`.

**Rationale**: `str.slice(i)` allocates a new string on every iteration, making `splitAnsiTokens` O(n^2) in memory. A global/sticky regex advances through the string without copying.

**Approach**:
- Use a single global regex that captures both ANSI sequences and text runs: `/(\x1b\[[0-9;]*m)|([^\x1b]+)/g`
- `splitAnsiTokens` becomes a single `matchAll` loop.
- `sliceVisible` and `splitLineBySeparators` use the same pattern instead of duplicating ANSI detection.
- `truncateToWidth` avoids double-scanning by integrating the width check into `sliceVisible` (return early if string fits).

### Optimized transcript parsing (transcript.ts)

**Decision**: Two optimizations:

1. **Lazy timestamp construction**: Only create `Date` objects for `sessionStart` (first entry) and entries with `tool_use`/`tool_result` blocks that are actively running. Skip `new Date()` for completed/historical entries.

2. **Tail-read for large files**: Use `fs.stat` to get file size. If the file exceeds a threshold (e.g., 256KB), seek to the last N bytes (e.g., 64KB) and parse only that tail. This covers recent tool activity. For `sessionStart`, read only the first line separately.

**Alternative considered**: Byte-offset tracking between invocations via temp file. Rejected because the process is ephemeral and writing state adds complexity and its own I/O cost.

**Trade-off**: Tail-read may miss some `tool_use` blocks whose `tool_result` appears in the tail. Mitigation: use a generous tail size (64KB ≈ ~500 transcript lines) and treat tools without a `tool_use` match as unknown/completed.

## Risks / Trade-offs

- **Git porcelain v2 compatibility** → Requires git >= 2.11. Mitigated by fallback to current three-command approach on failure.
- **Parallel I/O error semantics** → A failure in one parallel branch should not crash the others. Mitigated by wrapping each in try/catch returning defaults (matches current behavior).
- **Tail-read transcript accuracy** → May miss old running tools in very long sessions. Mitigated by generous tail size and graceful degradation (show tools as completed rather than missing).
- **Sticky regex browser compat** → Not relevant; runs on Node 18+ where sticky flag is fully supported.
