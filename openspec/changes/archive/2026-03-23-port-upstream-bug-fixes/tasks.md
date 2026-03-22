## 1. Terminal Width and Adaptive Bar

- [x] 1.1 Add stderr fallback to getTerminalWidth() in src/render/index.ts
- [x] 1.2 Create src/utils/terminal.ts with getAdaptiveBarWidth() utility
- [x] 1.3 Replace hardcoded bar width 10 with getAdaptiveBarWidth() in src/render/lines/identity.ts
- [x] 1.4 Replace hardcoded bar width 10 with getAdaptiveBarWidth() in src/render/format.ts
- [x] 1.5 Replace hardcoded bar width 10 with getAdaptiveBarWidth() in src/render/session-line.ts

## 2. Expanded Layout Fixes

- [x] 2.1 Add showSpeed rendering to renderProjectLine in src/render/lines/project.ts
- [x] 2.2 Add showDuration rendering to renderProjectLine in src/render/lines/project.ts
- [x] 2.3 Add extraLabel rendering to renderProjectLine in src/render/lines/project.ts

## 3. Usage Time Format

- [x] 3.1 Change usage reset time format to "resets in" wording in src/render/format.ts

## 4. Initialization and Setup

- [x] 4.1 Add macOS restart hint in src/index.ts when stdin is missing
- [x] 4.2 Update commands/setup.md to respect CLAUDE_CONFIG_DIR

## 5. Plugin Packaging

- [x] 5.1 Add commands field to .claude-plugin/plugin.json
- [x] 5.2 Add files field to package.json

## 6. Build and Verify

- [x] 6.1 Build and run tests
- [x] 6.2 Update 3 test assertions for "resets in" format (render.test.js)

## 7. Simplify Review Fixes

- [x] 7.1 Cache getAdaptiveBarWidth() result in formatUsageDisplay to avoid repeated calls
- [x] 7.2 Normalize timer emoji representation in project.ts (unicode escape to literal)
