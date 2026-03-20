import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractUsage } from '../dist/usage.js';

test('extractUsage returns null when rate_limits is absent', () => {
  assert.equal(extractUsage({}), null);
  assert.equal(extractUsage({ model: { display_name: 'Opus' } }), null);
});

test('extractUsage returns null when rate_limits is null', () => {
  assert.equal(extractUsage({ rate_limits: null }), null);
});

test('extractUsage returns null when rate_limits is empty object', () => {
  assert.equal(extractUsage({ rate_limits: {} }), null);
});

test('extractUsage parses valid five_hour and seven_day data', () => {
  const result = extractUsage({
    rate_limits: {
      five_hour: { used_percentage: 45.000000000000001, resets_at: 1711123456 },
      seven_day: { used_percentage: 62, resets_at: 1711299456 },
    },
  });
  assert.equal(result?.fiveHour, 45);
  assert.equal(result?.sevenDay, 62);
  assert.deepEqual(result?.fiveHourResetAt, new Date(1711123456 * 1000));
  assert.deepEqual(result?.sevenDayResetAt, new Date(1711299456 * 1000));
});

test('extractUsage rounds percentages with Math.round', () => {
  const result = extractUsage({
    rate_limits: {
      five_hour: { used_percentage: 7.5 },
    },
  });
  assert.equal(result?.fiveHour, 8);
});

test('extractUsage handles used_percentage of 0', () => {
  const result = extractUsage({
    rate_limits: {
      five_hour: { used_percentage: 0, resets_at: 1711123456 },
    },
  });
  assert.equal(result?.fiveHour, 0);
  assert.equal(result?.sevenDay, null);
});

test('extractUsage clamps values above 100', () => {
  const result = extractUsage({
    rate_limits: {
      five_hour: { used_percentage: 150 },
    },
  });
  assert.equal(result?.fiveHour, 100);
});

test('extractUsage clamps negative values to 0', () => {
  const result = extractUsage({
    rate_limits: {
      five_hour: { used_percentage: -10 },
    },
  });
  assert.equal(result?.fiveHour, 0);
});

test('extractUsage returns null resetAt for resets_at <= 0', () => {
  const result = extractUsage({
    rate_limits: {
      five_hour: { used_percentage: 50, resets_at: 0 },
    },
  });
  assert.equal(result?.fiveHour, 50);
  assert.equal(result?.fiveHourResetAt, null);
});

test('extractUsage returns null resetAt for negative resets_at', () => {
  const result = extractUsage({
    rate_limits: {
      five_hour: { used_percentage: 50, resets_at: -1 },
    },
  });
  assert.equal(result?.fiveHourResetAt, null);
});

test('extractUsage handles NaN used_percentage', () => {
  const result = extractUsage({
    rate_limits: {
      five_hour: { used_percentage: NaN },
    },
  });
  assert.equal(result, null);
});

test('extractUsage handles single window only', () => {
  const result = extractUsage({
    rate_limits: {
      seven_day: { used_percentage: 30 },
    },
  });
  assert.equal(result?.fiveHour, null);
  assert.equal(result?.sevenDay, 30);
});
