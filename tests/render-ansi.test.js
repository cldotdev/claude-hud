import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitAnsiTokens,
  visualLength,
  sliceVisible,
  splitLineBySeparators,
  truncateToWidth,
} from '../dist/render/index.js';

const ESC = '\x1b[';
const RED = `${ESC}31m`;
const GREEN = `${ESC}32m`;
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;

// ---------------------------------------------------------------------------
// splitAnsiTokens
// ---------------------------------------------------------------------------

test('splitAnsiTokens: plain text', () => {
  const tokens = splitAnsiTokens('hello world');
  assert.deepEqual(tokens, [
    { type: 'text', value: 'hello world' },
  ]);
});

test('splitAnsiTokens: ANSI-only string', () => {
  const tokens = splitAnsiTokens(`${RED}${RESET}`);
  assert.deepEqual(tokens, [
    { type: 'ansi', value: RED },
    { type: 'ansi', value: RESET },
  ]);
});

test('splitAnsiTokens: mixed ANSI and text', () => {
  const input = `${RED}hello${RESET} world`;
  const tokens = splitAnsiTokens(input);
  assert.deepEqual(tokens, [
    { type: 'ansi', value: RED },
    { type: 'text', value: 'hello' },
    { type: 'ansi', value: RESET },
    { type: 'text', value: ' world' },
  ]);
});

test('splitAnsiTokens: CJK characters', () => {
  const tokens = splitAnsiTokens('你好世界');
  assert.deepEqual(tokens, [
    { type: 'text', value: '你好世界' },
  ]);
});

test('splitAnsiTokens: emoji', () => {
  const tokens = splitAnsiTokens('hi 🎉 ok');
  assert.deepEqual(tokens, [
    { type: 'text', value: 'hi 🎉 ok' },
  ]);
});

test('splitAnsiTokens: empty string', () => {
  const tokens = splitAnsiTokens('');
  assert.deepEqual(tokens, []);
});

test('splitAnsiTokens: multiple ANSI codes adjacent', () => {
  const input = `${RED}${BOLD}text${RESET}`;
  const tokens = splitAnsiTokens(input);
  assert.deepEqual(tokens, [
    { type: 'ansi', value: RED },
    { type: 'ansi', value: BOLD },
    { type: 'text', value: 'text' },
    { type: 'ansi', value: RESET },
  ]);
});

// ---------------------------------------------------------------------------
// visualLength
// ---------------------------------------------------------------------------

test('visualLength: plain ASCII', () => {
  assert.equal(visualLength('hello'), 5);
});

test('visualLength: ignores ANSI escapes', () => {
  assert.equal(visualLength(`${RED}hello${RESET}`), 5);
});

test('visualLength: CJK characters are double-width', () => {
  assert.equal(visualLength('你好'), 4);
});

test('visualLength: emoji is double-width', () => {
  assert.equal(visualLength('🎉'), 2);
});

test('visualLength: empty string', () => {
  assert.equal(visualLength(''), 0);
});

test('visualLength: mixed ANSI + CJK', () => {
  assert.equal(visualLength(`${GREEN}你好${RESET}world`), 9);
});

// ---------------------------------------------------------------------------
// sliceVisible
// ---------------------------------------------------------------------------

test('sliceVisible: plain text within limit', () => {
  assert.equal(sliceVisible('hello', 10), 'hello');
});

test('sliceVisible: plain text truncated', () => {
  assert.equal(sliceVisible('hello world', 5), 'hello');
});

test('sliceVisible: preserves ANSI codes', () => {
  const input = `${RED}hello${RESET}`;
  const result = sliceVisible(input, 3);
  assert.equal(result, `${RED}hel`);
});

test('sliceVisible: CJK respects double-width boundary', () => {
  // Each CJK char is 2 columns; maxVisible=3 fits only 1 CJK char (2 cols)
  const result = sliceVisible('你好世', 3);
  assert.equal(result, '你');
});

test('sliceVisible: emoji respects double-width', () => {
  const result = sliceVisible('🎉🎊', 3);
  assert.equal(result, '🎉');
});

test('sliceVisible: empty string', () => {
  assert.equal(sliceVisible('', 5), '');
});

test('sliceVisible: maxVisible zero returns empty', () => {
  assert.equal(sliceVisible('hello', 0), '');
});

test('sliceVisible: ANSI-only string passes through fully', () => {
  const input = `${RED}${GREEN}${RESET}`;
  assert.equal(sliceVisible(input, 5), input);
});

test('sliceVisible: mixed ANSI and CJK', () => {
  const input = `${RED}你${RESET}好世`;
  // maxVisible=3 -> 你 (2) + RESET is ANSI -> 好 would be 4, over limit
  const result = sliceVisible(input, 3);
  assert.equal(result, `${RED}你${RESET}`);
});

// ---------------------------------------------------------------------------
// splitLineBySeparators
// ---------------------------------------------------------------------------

test('splitLineBySeparators: no separator', () => {
  const { segments, separators } = splitLineBySeparators('hello world');
  assert.deepEqual(segments, ['hello world']);
  assert.deepEqual(separators, []);
});

test('splitLineBySeparators: pipe separator', () => {
  const { segments, separators } = splitLineBySeparators('a | b | c');
  assert.deepEqual(segments, ['a', 'b', 'c']);
  assert.deepEqual(separators, [' | ', ' | ']);
});

test('splitLineBySeparators: box-drawing separator', () => {
  const { segments, separators } = splitLineBySeparators('foo \u2502 bar');
  assert.deepEqual(segments, ['foo', 'bar']);
  assert.deepEqual(separators, [' \u2502 ']);
});

test('splitLineBySeparators: ANSI codes around separator', () => {
  const input = `${RED}left${RESET} | ${GREEN}right${RESET}`;
  const { segments, separators } = splitLineBySeparators(input);
  assert.deepEqual(segments, [`${RED}left${RESET}`, `${GREEN}right${RESET}`]);
  assert.deepEqual(separators, [' | ']);
});

test('splitLineBySeparators: empty string', () => {
  const { segments, separators } = splitLineBySeparators('');
  assert.deepEqual(segments, ['']);
  assert.deepEqual(separators, []);
});

test('splitLineBySeparators: ANSI-only string', () => {
  const input = `${RED}${RESET}`;
  const { segments, separators } = splitLineBySeparators(input);
  assert.deepEqual(segments, [input]);
  assert.deepEqual(separators, []);
});

test('splitLineBySeparators: mixed separators', () => {
  const { segments, separators } = splitLineBySeparators('a | b \u2502 c');
  assert.deepEqual(segments, ['a', 'b', 'c']);
  assert.deepEqual(separators, [' | ', ' \u2502 ']);
});

// ---------------------------------------------------------------------------
// truncateToWidth
// ---------------------------------------------------------------------------

test('truncateToWidth: string fits within maxWidth', () => {
  assert.equal(truncateToWidth('hello', 10), 'hello');
});

test('truncateToWidth: string exactly at maxWidth', () => {
  assert.equal(truncateToWidth('hello', 5), 'hello');
});

test('truncateToWidth: plain text truncated with ellipsis', () => {
  const result = truncateToWidth('hello world', 8);
  // 8 chars total: 5 keep + 3 dots
  assert.ok(result.includes('...'));
  assert.ok(result.startsWith('hello'));
});

test('truncateToWidth: CJK truncation', () => {
  // '你好世界' is 8 columns, maxWidth=5 -> keep=2 -> 1 CJK char (2 cols) + '...'
  const result = truncateToWidth('你好世界', 5);
  assert.ok(result.includes('...'));
  // Strip ANSI to verify content
  const stripped = result.replace(/\x1b\[[0-9;]*m/g, '');
  assert.ok(stripped.startsWith('你'));
});

test('truncateToWidth: emoji truncation', () => {
  const result = truncateToWidth('🎉🎊🎈🎆', 5);
  assert.ok(result.includes('...'));
});

test('truncateToWidth: ANSI codes in string that fits', () => {
  const input = `${RED}hi${RESET}`;
  assert.equal(truncateToWidth(input, 10), input);
});

test('truncateToWidth: empty string', () => {
  assert.equal(truncateToWidth('', 5), '');
});

test('truncateToWidth: very narrow width uses dots', () => {
  const result = truncateToWidth('hello', 2);
  assert.ok(result.includes('..'));
});

test('truncateToWidth: maxWidth zero returns original', () => {
  assert.equal(truncateToWidth('hello', 0), 'hello');
});

// ---------------------------------------------------------------------------
// Consistency: splitAnsiTokens round-trip
// ---------------------------------------------------------------------------

test('splitAnsiTokens round-trip reconstructs original string', () => {
  const inputs = [
    '',
    'plain',
    `${RED}colored${RESET}`,
    `${RED}${BOLD}bold red${RESET} normal`,
    '你好 🎉 world',
    `${GREEN}你好${RESET} | ${RED}世界${RESET}`,
  ];

  for (const input of inputs) {
    const tokens = splitAnsiTokens(input);
    const reconstructed = tokens.map(t => t.value).join('');
    assert.equal(reconstructed, input, `round-trip failed for: ${JSON.stringify(input)}`);
  }
});

// ---------------------------------------------------------------------------
// Consistency: visualLength matches sliceVisible
// ---------------------------------------------------------------------------

test('sliceVisible with full width returns equivalent content', () => {
  const inputs = [
    'hello',
    `${RED}hello${RESET}`,
    '你好世界',
    `${GREEN}🎉${RESET} ok`,
  ];

  for (const input of inputs) {
    const len = visualLength(input);
    const sliced = sliceVisible(input, len);
    assert.equal(visualLength(sliced), len, `sliceVisible at full width differs for: ${JSON.stringify(input)}`);
  }
});
