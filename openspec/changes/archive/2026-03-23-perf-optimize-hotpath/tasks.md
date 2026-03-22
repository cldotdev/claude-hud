## 1. Shared Config Parse

- [x] 1.1 Add `readJsonFileCached` helper with per-invocation Map cache in config-reader.ts
- [x] 1.2 Refactor `getMcpServerNames`, `getDisabledMcpServers`, `countHooksInFile` to accept parsed JSON instead of file path
- [x] 1.3 Update `countConfigs` to read each file once via cache and pass parsed objects to helpers
- [x] 1.4 Write tests verifying each file is read at most once and output parity with previous implementation

## 2. Single Git Command

- [x] 2.1 Implement `parseGitStatusV2` to parse `git status -b --porcelain=v2` output (branch, ahead/behind, file stats)
- [x] 2.2 Rewrite `getGitStatus` to use single `git status -b --porcelain=v2` with fallback to legacy approach
- [x] 2.3 Write tests for porcelain v2 parsing: normal repo, no upstream, detached HEAD, mixed file changes, clean tree
- [x] 2.4 Write test for fallback behavior when porcelain v2 fails

## 3. Efficient ANSI Rendering

- [x] 3.1 Rewrite `splitAnsiTokens` using global regex `matchAll` instead of `str.slice(i)` loops
- [x] 3.2 Rewrite `sliceVisible` to use the same global regex approach, eliminating `str.slice(i)`
- [x] 3.3 Rewrite `splitLineBySeparators` to avoid substring allocation for ANSI skipping
- [x] 3.4 Optimize `truncateToWidth` to combine width-check and slice into single pass
- [x] 3.5 Write tests verifying identical output for strings with ANSI codes, CJK characters, emoji, and plain text

## 4. Optimized Transcript Parsing

- [x] 4.1 Add lazy timestamp construction: only create Date objects for sessionStart and tool_use/tool_result entries
- [x] 4.2 Implement tail-read strategy: `fs.stat` size check, read first line + last 64KB for files over 256KB
- [x] 4.3 Write tests for small file (full parse), large file (tail parse), and sessionStart accuracy

## 5. Parallel I/O Orchestration

- [x] 5.1 Refactor `main()` to run `loadConfig` and `countConfigs` first (sync I/O), then `Promise.all` for `parseTranscript`, `getGitStatus`, `runExtraCmd`
- [x] 5.2 Ensure each parallel branch handles its own errors and returns safe defaults
- [x] 5.3 Write tests verifying parallel execution and that individual failures don't block others

## 6. Simplify Cleanup (ad-hoc)

- [x] 6.1 TOCTOU fix: replace `existsSync` + `readFileSync` with direct read + catch ENOENT in config-reader.ts
- [x] 6.2 TOCTOU fix: replace `existsSync` + `statSync` with direct `statSync` + catch ENOENT in transcript.ts
- [x] 6.3 `Buffer.alloc` to `Buffer.allocUnsafe` for tail-read buffers in transcript.ts
- [x] 6.4 Extract `ParseState` interface to reduce parameter sprawl in transcript.ts
- [x] 6.5 Extract `updateMeta` function to eliminate slug/customTitle copy-paste in transcript.ts
- [x] 6.6 Fix `extractTarget` Bash case returning `"undefined"` string when `input.command` is missing
- [x] 6.7 `collectActivityLines` delegates to `renderElementLine` instead of duplicating show/hide logic
- [x] 6.8 Extract shared `getTerminalWidth` to `utils/terminal.ts`, reuse in render/index.ts and getAdaptiveBarWidth
- [x] 6.9 `truncateToWidth` early exit when truncation is confirmed (avoid scanning remaining graphemes)
- [x] 6.10 Hoist `graphemeWidth` Unicode regex patterns to module-level constants
- [x] 6.11 Parallelize legacy git fallback's `status --porcelain` and `rev-list` with `Promise.all`
- [x] 6.12 `collectActivityLines` uses `ACTIVITY_ELEMENTS` Set instead of hardcoded array
