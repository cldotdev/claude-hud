import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { readJsonFileCached, countConfigs } from '../dist/config-reader.js';

function restoreEnvVar(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

// --- readJsonFileCached unit tests ---

test('readJsonFileCached returns parsed object for valid JSON file', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'hud-cache-'));
  try {
    const filePath = path.join(dir, 'valid.json');
    await writeFile(filePath, JSON.stringify({ mcpServers: { a: {} }, hooks: { h1: {} } }), 'utf8');

    const cache = new Map();
    const result = readJsonFileCached(filePath, cache);

    assert.notEqual(result, null);
    assert.deepEqual(Object.keys(result.mcpServers), ['a']);
    assert.deepEqual(Object.keys(result.hooks), ['h1']);
    assert.ok(cache.has(filePath), 'cache should contain the file path');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('readJsonFileCached returns null for missing file and caches it', async () => {
  const cache = new Map();
  const result = readJsonFileCached('/nonexistent/path/to/file.json', cache);

  assert.equal(result, null);
  assert.ok(cache.has('/nonexistent/path/to/file.json'), 'cache should contain the missing path');
  assert.equal(cache.get('/nonexistent/path/to/file.json'), null, 'cached value for missing file should be null');
});

test('readJsonFileCached returns null for invalid JSON and caches it', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'hud-cache-'));
  try {
    const filePath = path.join(dir, 'bad.json');
    await writeFile(filePath, '{bad json', 'utf8');

    const cache = new Map();
    const result = readJsonFileCached(filePath, cache);

    assert.equal(result, null);
    assert.ok(cache.has(filePath));
    assert.equal(cache.get(filePath), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('readJsonFileCached returns null for JSON array (non-object)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'hud-cache-'));
  try {
    const filePath = path.join(dir, 'array.json');
    await writeFile(filePath, '[1, 2, 3]', 'utf8');

    const cache = new Map();
    const result = readJsonFileCached(filePath, cache);

    assert.equal(result, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('readJsonFileCached serves second call from cache without re-reading', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'hud-cache-'));
  try {
    const filePath = path.join(dir, 'data.json');
    await writeFile(filePath, JSON.stringify({ key: 'original' }), 'utf8');

    const cache = new Map();

    // First read
    const result1 = readJsonFileCached(filePath, cache);
    assert.equal(result1.key, 'original');

    // Overwrite the file on disk
    await writeFile(filePath, JSON.stringify({ key: 'modified' }), 'utf8');

    // Second read should return the cached (original) value, proving no re-read
    const result2 = readJsonFileCached(filePath, cache);
    assert.equal(result2.key, 'original', 'should return cached value, not re-read file');
    assert.equal(result1, result2, 'should be the exact same object reference');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('readJsonFileCached caches null for missing file and does not re-check', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'hud-cache-'));
  try {
    const filePath = path.join(dir, 'late.json');
    const cache = new Map();

    // Read when file doesn't exist
    const result1 = readJsonFileCached(filePath, cache);
    assert.equal(result1, null);

    // Create the file
    await writeFile(filePath, JSON.stringify({ key: 'created' }), 'utf8');

    // Second read should still return null (cached non-existence)
    const result2 = readJsonFileCached(filePath, cache);
    assert.equal(result2, null, 'should return cached null, not re-check filesystem');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- Verify cache deduplicates reads across helpers ---

test('readJsonFileCached deduplicates across multiple helper-style accesses', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'hud-dedup-'));
  try {
    const filePath = path.join(dir, 'settings.json');
    await writeFile(
      filePath,
      JSON.stringify({ mcpServers: { a: {}, b: {} }, hooks: { h1: {} }, disabledMcpServers: ['b'] }),
      'utf8'
    );

    const cache = new Map();

    // Simulate multiple helper accesses to the same file (like countConfigs does)
    const config1 = readJsonFileCached(filePath, cache);
    const config2 = readJsonFileCached(filePath, cache);
    const config3 = readJsonFileCached(filePath, cache);

    // All should return the exact same reference
    assert.equal(config1, config2, 'second access should return same reference');
    assert.equal(config2, config3, 'third access should return same reference');
    assert.equal(cache.size, 1, 'cache should contain exactly one entry');

    // Verify the data is correct
    assert.deepEqual(Object.keys(config1.mcpServers), ['a', 'b']);
    assert.deepEqual(Object.keys(config1.hooks), ['h1']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- Output parity tests ---

test('countConfigs output parity: full project and user scope', async () => {
  const homeDir = await mkdtemp(path.join(tmpdir(), 'hud-parity-home-'));
  const projectDir = await mkdtemp(path.join(tmpdir(), 'hud-parity-project-'));
  const originalHome = process.env.HOME;
  const originalConfigDir = process.env.CLAUDE_CONFIG_DIR;
  process.env.HOME = homeDir;
  delete process.env.CLAUDE_CONFIG_DIR;

  try {
    // User scope
    await mkdir(path.join(homeDir, '.claude', 'rules', 'nested'), { recursive: true });
    await writeFile(path.join(homeDir, '.claude', 'CLAUDE.md'), 'global', 'utf8');
    await writeFile(path.join(homeDir, '.claude', 'rules', 'rule.md'), '# rule', 'utf8');
    await writeFile(path.join(homeDir, '.claude', 'rules', 'nested', 'rule-nested.md'), '# rule nested', 'utf8');
    await writeFile(
      path.join(homeDir, '.claude', 'settings.json'),
      JSON.stringify({ mcpServers: { one: {} }, hooks: { onStart: {} } }),
      'utf8'
    );
    await writeFile(path.join(homeDir, '.claude.json'), '{bad json', 'utf8');

    // Project scope
    await mkdir(path.join(projectDir, '.claude', 'rules'), { recursive: true });
    await writeFile(path.join(projectDir, 'CLAUDE.md'), 'project', 'utf8');
    await writeFile(path.join(projectDir, 'CLAUDE.local.md'), 'project-local', 'utf8');
    await writeFile(path.join(projectDir, '.claude', 'CLAUDE.md'), 'project-alt', 'utf8');
    await writeFile(path.join(projectDir, '.claude', 'CLAUDE.local.md'), 'project-alt-local', 'utf8');
    await writeFile(path.join(projectDir, '.claude', 'rules', 'rule2.md'), '# rule2', 'utf8');
    await writeFile(
      path.join(projectDir, '.claude', 'settings.json'),
      JSON.stringify({ mcpServers: { two: {}, three: {} }, hooks: { onStop: {} } }),
      'utf8'
    );
    await writeFile(path.join(projectDir, '.claude', 'settings.local.json'), '{bad json', 'utf8');
    await writeFile(path.join(projectDir, '.mcp.json'), JSON.stringify({ mcpServers: { four: {} } }), 'utf8');

    const counts = await countConfigs(projectDir);
    assert.equal(counts.claudeMdCount, 5);
    assert.equal(counts.rulesCount, 3);
    assert.equal(counts.mcpCount, 4);
    assert.equal(counts.hooksCount, 2);
  } finally {
    restoreEnvVar('HOME', originalHome);
    restoreEnvVar('CLAUDE_CONFIG_DIR', originalConfigDir);
    await rm(homeDir, { recursive: true, force: true });
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('countConfigs output parity: disabled MCP servers', async () => {
  const homeDir = await mkdtemp(path.join(tmpdir(), 'hud-parity-home-'));
  const originalHome = process.env.HOME;
  const originalConfigDir = process.env.CLAUDE_CONFIG_DIR;
  process.env.HOME = homeDir;
  delete process.env.CLAUDE_CONFIG_DIR;

  try {
    await mkdir(path.join(homeDir, '.claude'), { recursive: true });
    await writeFile(
      path.join(homeDir, '.claude', 'settings.json'),
      JSON.stringify({ mcpServers: { serverA: {}, serverB: {}, serverC: {} } }),
      'utf8'
    );
    await writeFile(
      path.join(homeDir, '.claude.json'),
      JSON.stringify({ disabledMcpServers: ['serverA', 'serverC'] }),
      'utf8'
    );

    const counts = await countConfigs();
    assert.equal(counts.mcpCount, 1, 'only serverB remains after disabling A and C');
  } finally {
    restoreEnvVar('HOME', originalHome);
    restoreEnvVar('CLAUDE_CONFIG_DIR', originalConfigDir);
    await rm(homeDir, { recursive: true, force: true });
  }
});

test('countConfigs output parity: disabled project .mcp.json servers', async () => {
  const homeDir = await mkdtemp(path.join(tmpdir(), 'hud-parity-home-'));
  const projectDir = await mkdtemp(path.join(tmpdir(), 'hud-parity-project-'));
  const originalHome = process.env.HOME;
  const originalConfigDir = process.env.CLAUDE_CONFIG_DIR;
  process.env.HOME = homeDir;
  delete process.env.CLAUDE_CONFIG_DIR;

  try {
    await mkdir(path.join(homeDir, '.claude'), { recursive: true });
    await writeFile(path.join(homeDir, '.claude', 'settings.json'), '{}', 'utf8');
    await writeFile(path.join(homeDir, '.claude.json'), '{}', 'utf8');

    await mkdir(path.join(projectDir, '.claude'), { recursive: true });
    await writeFile(
      path.join(projectDir, '.mcp.json'),
      JSON.stringify({ mcpServers: { srvA: {}, srvB: {}, srvC: {} } }),
      'utf8'
    );
    await writeFile(
      path.join(projectDir, '.claude', 'settings.local.json'),
      JSON.stringify({ disabledMcpjsonServers: ['srvB'] }),
      'utf8'
    );

    const counts = await countConfigs(projectDir);
    assert.equal(counts.mcpCount, 2, 'srvA + srvC (srvB disabled)');
  } finally {
    restoreEnvVar('HOME', originalHome);
    restoreEnvVar('CLAUDE_CONFIG_DIR', originalConfigDir);
    await rm(homeDir, { recursive: true, force: true });
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('countConfigs output parity: no cwd', async () => {
  const homeDir = await mkdtemp(path.join(tmpdir(), 'hud-parity-home-'));
  const originalHome = process.env.HOME;
  const originalConfigDir = process.env.CLAUDE_CONFIG_DIR;
  process.env.HOME = homeDir;
  delete process.env.CLAUDE_CONFIG_DIR;

  try {
    await mkdir(path.join(homeDir, '.claude'), { recursive: true });
    await writeFile(path.join(homeDir, '.claude', 'CLAUDE.md'), 'global', 'utf8');
    await writeFile(
      path.join(homeDir, '.claude', 'settings.json'),
      JSON.stringify({ mcpServers: { s1: {} }, hooks: { h1: {}, h2: {} } }),
      'utf8'
    );

    const counts = await countConfigs();
    assert.equal(counts.claudeMdCount, 1);
    assert.equal(counts.rulesCount, 0);
    assert.equal(counts.mcpCount, 1);
    assert.equal(counts.hooksCount, 2);
  } finally {
    restoreEnvVar('HOME', originalHome);
    restoreEnvVar('CLAUDE_CONFIG_DIR', originalConfigDir);
    await rm(homeDir, { recursive: true, force: true });
  }
});

test('readJsonFileCached caches null for missing files consistently', async () => {
  const cache = new Map();

  // Multiple accesses to the same missing file
  const result1 = readJsonFileCached('/no/such/settings.json', cache);
  const result2 = readJsonFileCached('/no/such/settings.json', cache);
  const result3 = readJsonFileCached('/no/such/other.json', cache);

  assert.equal(result1, null);
  assert.equal(result2, null);
  assert.equal(result3, null);
  assert.equal(cache.size, 2, 'two unique paths should be cached');
});
