import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseTranscript, TAIL_THRESHOLD, TAIL_SIZE } from '../dist/transcript.js';

/**
 * Build a JSONL transcript line.
 * @param {object} opts
 * @param {string} [opts.timestamp] - ISO timestamp
 * @param {Array}  [opts.content]   - message content blocks
 * @param {string} [opts.slug]      - session slug
 * @returns {string} JSON-encoded line
 */
function line({ timestamp, content, slug } = {}) {
  const obj = {};
  if (timestamp) obj.timestamp = timestamp;
  if (slug) obj.slug = slug;
  if (content) obj.message = { content };
  return JSON.stringify(obj);
}

/** Build a tool_use content block */
function toolUse(id, name, input) {
  return { type: 'tool_use', id, name, ...(input ? { input } : {}) };
}

/** Build a tool_result content block */
function toolResult(toolUseId, isError = false) {
  return { type: 'tool_result', tool_use_id: toolUseId, is_error: isError };
}

let tmpDir;

test('transcript-perf setup', async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), 'hud-perf-'));
});

// -- Small file tests (under TAIL_THRESHOLD, uses readline path) --

test('small file: parses tools and sessionStart correctly', async () => {
  const filePath = path.join(tmpDir, 'small-basic.jsonl');
  const ts1 = '2026-03-23T10:00:00.000Z';
  const ts2 = '2026-03-23T10:00:01.000Z';

  const lines = [
    line({ timestamp: ts1, content: [toolUse('t1', 'Read', { file_path: '/foo.ts' })] }),
    line({ timestamp: ts2, content: [toolResult('t1')] }),
  ];
  await writeFile(filePath, lines.join('\n') + '\n');

  const result = await parseTranscript(filePath);

  assert.ok(result.sessionStart instanceof Date);
  assert.equal(result.sessionStart.toISOString(), ts1);
  assert.equal(result.tools.length, 1);
  assert.equal(result.tools[0].name, 'Read');
  assert.equal(result.tools[0].status, 'completed');
  assert.equal(result.tools[0].target, '/foo.ts');
  assert.ok(result.tools[0].endTime instanceof Date);
  assert.equal(result.tools[0].endTime.toISOString(), ts2);
});

test('small file: entries without tool blocks do not create Date objects needlessly', async () => {
  // This test verifies the function works correctly with entries that have no
  // content blocks (the lazy timestamp path avoids constructing Date for these).
  const filePath = path.join(tmpDir, 'small-lazy.jsonl');
  const ts1 = '2026-03-23T09:00:00.000Z';
  const ts2 = '2026-03-23T09:05:00.000Z';

  const lines = [
    line({ timestamp: ts1, slug: 'test-session' }),
    // 50 lines with no content blocks (no Date needed)
    ...Array.from({ length: 50 }, (_, i) =>
      line({ timestamp: `2026-03-23T09:01:${String(i).padStart(2, '0')}.000Z` })
    ),
    line({ timestamp: ts2, content: [toolUse('t1', 'Bash', { command: 'echo hello' })] }),
  ];
  await writeFile(filePath, lines.join('\n') + '\n');

  const result = await parseTranscript(filePath);

  assert.equal(result.sessionStart.toISOString(), ts1);
  assert.equal(result.tools.length, 1);
  assert.equal(result.tools[0].name, 'Bash');
  assert.equal(result.tools[0].status, 'running');
});

test('small file: TodoWrite and agents parse correctly', async () => {
  const filePath = path.join(tmpDir, 'small-todos.jsonl');
  const ts = '2026-03-23T10:00:00.000Z';

  const lines = [
    line({
      timestamp: ts,
      content: [toolUse('tw1', 'TodoWrite', {
        todos: [
          { content: 'Fix bug', status: 'pending' },
          { content: 'Write tests', status: 'in_progress' },
        ]
      })],
    }),
    line({
      timestamp: ts,
      content: [toolUse('a1', 'Task', {
        subagent_type: 'explore',
        model: 'haiku',
        description: 'Searching codebase',
      })],
    }),
  ];
  await writeFile(filePath, lines.join('\n') + '\n');

  const result = await parseTranscript(filePath);

  assert.equal(result.todos.length, 2);
  assert.equal(result.todos[0].content, 'Fix bug');
  assert.equal(result.todos[1].status, 'in_progress');
  assert.equal(result.agents.length, 1);
  assert.equal(result.agents[0].type, 'explore');
  assert.equal(result.agents[0].model, 'haiku');
});

// -- Large file tests (over TAIL_THRESHOLD, uses tail-read strategy) --

test('TAIL_THRESHOLD and TAIL_SIZE are exported with expected values', () => {
  assert.equal(TAIL_THRESHOLD, 256 * 1024);
  assert.equal(TAIL_SIZE, 64 * 1024);
});

test('large file: sessionStart comes from first line, tools from tail', async () => {
  const filePath = path.join(tmpDir, 'large-basic.jsonl');
  const sessionTs = '2026-03-23T08:00:00.000Z';
  const recentTs = '2026-03-23T12:00:00.000Z';

  // First line has the session start timestamp
  const firstLine = line({
    timestamp: sessionTs,
    slug: 'large-session',
    content: [toolUse('old1', 'Read', { file_path: '/old.ts' })],
  });

  // Recent tool activity that should appear in the tail
  const recentLines = [
    line({ timestamp: recentTs, content: [toolUse('r1', 'Edit', { file_path: '/recent.ts' })] }),
    line({ timestamp: '2026-03-23T12:00:01.000Z', content: [toolResult('r1')] }),
    line({ timestamp: '2026-03-23T12:00:02.000Z', content: [toolUse('r2', 'Grep', { pattern: 'TODO' })] }),
  ];

  // Build a file that exceeds TAIL_THRESHOLD with padding lines in the middle
  const paddingLineTemplate = line({
    timestamp: '2026-03-23T09:00:00.000Z',
    content: [toolUse('pad_ID', 'Read', { file_path: '/padding.ts' })],
  });
  // Each padding line is ~130 bytes; we need enough to exceed 256KB
  const paddingCount = Math.ceil(TAIL_THRESHOLD / paddingLineTemplate.length) + 100;
  const paddingLines = Array.from({ length: paddingCount }, (_, i) =>
    paddingLineTemplate.replace('pad_ID', `pad_${i}`)
  );

  const allLines = [firstLine, ...paddingLines, ...recentLines];
  await writeFile(filePath, allLines.join('\n') + '\n');

  // Verify the file is actually over the threshold
  const stat = fs.statSync(filePath);
  assert.ok(stat.size > TAIL_THRESHOLD, `File should be > ${TAIL_THRESHOLD} bytes, got ${stat.size}`);

  const result = await parseTranscript(filePath);

  // sessionStart should come from the very first line
  assert.ok(result.sessionStart instanceof Date);
  assert.equal(result.sessionStart.toISOString(), sessionTs);

  // Recent tools should be present (from tail)
  const editTool = result.tools.find(t => t.name === 'Edit');
  assert.ok(editTool, 'Should find Edit tool from tail');
  assert.equal(editTool.status, 'completed');
  assert.equal(editTool.target, '/recent.ts');

  const grepTool = result.tools.find(t => t.name === 'Grep');
  assert.ok(grepTool, 'Should find Grep tool from tail');
  assert.equal(grepTool.status, 'running');

  assert.equal(result.sessionName, 'large-session');
});

test('large file: sessionStart accuracy matches first-line timestamp exactly', async () => {
  const filePath = path.join(tmpDir, 'large-session-accuracy.jsonl');
  const preciseTs = '2026-03-23T07:30:45.123Z';

  const firstLine = line({ timestamp: preciseTs });

  // Pad to exceed threshold
  const padLine = JSON.stringify({ timestamp: '2026-03-23T10:00:00.000Z', filler: 'x'.repeat(200) });
  const padCount = Math.ceil(TAIL_THRESHOLD / padLine.length) + 50;
  const padding = Array.from({ length: padCount }, () => padLine);

  const lastLine = line({
    timestamp: '2026-03-23T14:00:00.000Z',
    content: [toolUse('last1', 'Read', { file_path: '/last.ts' })],
  });

  await writeFile(filePath, [firstLine, ...padding, lastLine].join('\n') + '\n');

  const stat = fs.statSync(filePath);
  assert.ok(stat.size > TAIL_THRESHOLD);

  const result = await parseTranscript(filePath);

  assert.ok(result.sessionStart instanceof Date);
  assert.equal(result.sessionStart.toISOString(), preciseTs);
});

test('large file: todos and agents in tail are parsed', async () => {
  const filePath = path.join(tmpDir, 'large-todos.jsonl');
  const sessionTs = '2026-03-23T06:00:00.000Z';

  const firstLine = line({ timestamp: sessionTs });

  // Padding
  const padLine = JSON.stringify({ timestamp: '2026-03-23T07:00:00.000Z', filler: 'x'.repeat(200) });
  const padCount = Math.ceil(TAIL_THRESHOLD / padLine.length) + 50;
  const padding = Array.from({ length: padCount }, () => padLine);

  const tailLines = [
    line({
      timestamp: '2026-03-23T11:00:00.000Z',
      content: [toolUse('tw1', 'TodoWrite', {
        todos: [
          { content: 'Deploy', status: 'pending' },
          { content: 'Test', status: 'completed' },
        ],
      })],
    }),
    line({
      timestamp: '2026-03-23T11:00:01.000Z',
      content: [toolUse('ag1', 'Task', {
        subagent_type: 'code',
        model: 'sonnet',
        description: 'Implementing feature',
      })],
    }),
    line({
      timestamp: '2026-03-23T11:00:02.000Z',
      content: [toolResult('ag1')],
    }),
  ];

  await writeFile(filePath, [firstLine, ...padding, ...tailLines].join('\n') + '\n');

  const stat = fs.statSync(filePath);
  assert.ok(stat.size > TAIL_THRESHOLD);

  const result = await parseTranscript(filePath);

  assert.equal(result.todos.length, 2);
  assert.equal(result.todos[0].content, 'Deploy');
  assert.equal(result.todos[1].status, 'completed');

  assert.equal(result.agents.length, 1);
  assert.equal(result.agents[0].type, 'code');
  assert.equal(result.agents[0].status, 'completed');
  assert.ok(result.agents[0].endTime instanceof Date);
});

test('large file: custom-title in tail overrides slug from first line', async () => {
  const filePath = path.join(tmpDir, 'large-title.jsonl');

  const firstLine = line({ timestamp: '2026-03-23T06:00:00.000Z', slug: 'original-slug' });

  const padLine = JSON.stringify({ timestamp: '2026-03-23T07:00:00.000Z', filler: 'x'.repeat(200) });
  const padCount = Math.ceil(TAIL_THRESHOLD / padLine.length) + 50;
  const padding = Array.from({ length: padCount }, () => padLine);

  // custom-title entry in tail
  const titleLine = JSON.stringify({
    timestamp: '2026-03-23T11:00:00.000Z',
    type: 'custom-title',
    customTitle: 'My Custom Title',
  });

  await writeFile(filePath, [firstLine, ...padding, titleLine].join('\n') + '\n');

  const stat = fs.statSync(filePath);
  assert.ok(stat.size > TAIL_THRESHOLD);

  const result = await parseTranscript(filePath);
  assert.equal(result.sessionName, 'My Custom Title');
});

// -- Edge cases --

test('missing file returns empty result', async () => {
  const result = await parseTranscript(path.join(tmpDir, 'nonexistent.jsonl'));

  assert.deepEqual(result.tools, []);
  assert.deepEqual(result.agents, []);
  assert.deepEqual(result.todos, []);
  assert.equal(result.sessionStart, undefined);
});

test('empty file returns empty result', async () => {
  const filePath = path.join(tmpDir, 'empty.jsonl');
  await writeFile(filePath, '');

  const result = await parseTranscript(filePath);

  assert.deepEqual(result.tools, []);
  assert.deepEqual(result.agents, []);
  assert.deepEqual(result.todos, []);
});

test('file just under TAIL_THRESHOLD uses readline path', async () => {
  const filePath = path.join(tmpDir, 'just-under.jsonl');
  const ts = '2026-03-23T10:00:00.000Z';

  // Build a file just under the threshold.
  // Use a fixed-length ID to keep line sizes predictable.
  const sampleLine = line({ timestamp: ts, content: [toolUse('x'.repeat(8), 'Read', { file_path: '/u.ts' })] });
  const lineLen = Buffer.byteLength(sampleLine, 'utf-8') + 1; // +1 for newline
  const targetSize = TAIL_THRESHOLD - 2048; // 2KB safety margin
  const count = Math.floor(targetSize / lineLen);
  const fileLines = Array.from({ length: count }, (_, i) =>
    line({ timestamp: ts, content: [toolUse(`u${String(i).padStart(8, '0')}`, 'Read', { file_path: '/u.ts' })] })
  );
  await writeFile(filePath, fileLines.join('\n') + '\n');

  const stat = fs.statSync(filePath);
  assert.ok(stat.size <= TAIL_THRESHOLD, `File should be <= ${TAIL_THRESHOLD}, got ${stat.size}`);

  const result = await parseTranscript(filePath);
  assert.ok(result.sessionStart instanceof Date);
  assert.equal(result.sessionStart.toISOString(), ts);
  assert.ok(result.tools.length > 0);
});

// -- Cleanup --

test('transcript-perf cleanup', async () => {
  await rm(tmpDir, { recursive: true, force: true });
});
