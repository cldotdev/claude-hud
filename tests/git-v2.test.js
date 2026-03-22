import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGitStatusV2 } from '../dist/git.js';

// --- parseGitStatusV2: branch parsing ---

test('parseGitStatusV2 parses branch name from header', () => {
  const output = [
    '# branch.oid abc1234567890',
    '# branch.head main',
  ].join('\n');

  const result = parseGitStatusV2(output);
  assert.equal(result?.branch, 'main');
  assert.equal(result?.isDirty, false);
  assert.equal(result?.ahead, 0);
  assert.equal(result?.behind, 0);
  assert.equal(result?.fileStats, undefined);
});

test('parseGitStatusV2 parses feature branch with slashes', () => {
  const output = [
    '# branch.oid abc1234567890',
    '# branch.head feature/my-branch',
  ].join('\n');

  const result = parseGitStatusV2(output);
  assert.equal(result?.branch, 'feature/my-branch');
});

test('parseGitStatusV2 returns null when branch.head is missing', () => {
  const output = '# branch.oid abc1234567890\n';
  const result = parseGitStatusV2(output);
  assert.equal(result, null);
});

test('parseGitStatusV2 returns null for empty output', () => {
  const result = parseGitStatusV2('');
  assert.equal(result, null);
});

// --- parseGitStatusV2: detached HEAD ---

test('parseGitStatusV2 uses short oid for detached HEAD', () => {
  const output = [
    '# branch.oid abcdef1234567890abcdef1234567890abcdef12',
    '# branch.head (detached)',
  ].join('\n');

  const result = parseGitStatusV2(output);
  assert.equal(result?.branch, 'abcdef1');
});

test('parseGitStatusV2 uses HEAD when detached and oid missing', () => {
  const output = '# branch.head (detached)\n';
  const result = parseGitStatusV2(output);
  assert.equal(result?.branch, 'HEAD');
});

// --- parseGitStatusV2: ahead/behind ---

test('parseGitStatusV2 parses ahead/behind counts', () => {
  const output = [
    '# branch.oid abc1234567890',
    '# branch.head main',
    '# branch.upstream origin/main',
    '# branch.ab +3 -1',
  ].join('\n');

  const result = parseGitStatusV2(output);
  assert.equal(result?.ahead, 3);
  assert.equal(result?.behind, 1);
});

test('parseGitStatusV2 defaults ahead/behind to 0 without upstream', () => {
  const output = [
    '# branch.oid abc1234567890',
    '# branch.head main',
  ].join('\n');

  const result = parseGitStatusV2(output);
  assert.equal(result?.ahead, 0);
  assert.equal(result?.behind, 0);
});

test('parseGitStatusV2 handles zero ahead/behind', () => {
  const output = [
    '# branch.oid abc1234567890',
    '# branch.head main',
    '# branch.upstream origin/main',
    '# branch.ab +0 -0',
  ].join('\n');

  const result = parseGitStatusV2(output);
  assert.equal(result?.ahead, 0);
  assert.equal(result?.behind, 0);
});

// --- parseGitStatusV2: untracked files ---

test('parseGitStatusV2 counts untracked files', () => {
  const output = [
    '# branch.oid abc1234567890',
    '# branch.head main',
    '? untracked1.txt',
    '? untracked2.txt',
    '? subdir/untracked3.txt',
  ].join('\n');

  const result = parseGitStatusV2(output);
  assert.equal(result?.isDirty, true);
  assert.equal(result?.fileStats?.untracked, 3);
  assert.equal(result?.fileStats?.modified, 0);
  assert.equal(result?.fileStats?.added, 0);
  assert.equal(result?.fileStats?.deleted, 0);
});

// --- parseGitStatusV2: ordinary changed entries ---

test('parseGitStatusV2 counts worktree-modified files', () => {
  const output = [
    '# branch.oid abc1234567890',
    '# branch.head main',
    '1 .M N... 100644 100644 100644 abc123 def456 file.txt',
  ].join('\n');

  const result = parseGitStatusV2(output);
  assert.equal(result?.isDirty, true);
  assert.equal(result?.fileStats?.modified, 1);
});

test('parseGitStatusV2 counts index-modified files', () => {
  const output = [
    '# branch.oid abc1234567890',
    '# branch.head main',
    '1 M. N... 100644 100644 100644 abc123 def456 file.txt',
  ].join('\n');

  const result = parseGitStatusV2(output);
  assert.equal(result?.fileStats?.modified, 1);
});

test('parseGitStatusV2 counts staged added files', () => {
  const output = [
    '# branch.oid abc1234567890',
    '# branch.head main',
    '1 A. N... 000000 100644 100644 000000 abc123 newfile.txt',
  ].join('\n');

  const result = parseGitStatusV2(output);
  assert.equal(result?.isDirty, true);
  assert.equal(result?.fileStats?.added, 1);
  assert.equal(result?.fileStats?.modified, 0);
});

test('parseGitStatusV2 counts index-deleted files', () => {
  const output = [
    '# branch.oid abc1234567890',
    '# branch.head main',
    '1 D. N... 100644 000000 000000 abc123 000000 deleted.txt',
  ].join('\n');

  const result = parseGitStatusV2(output);
  assert.equal(result?.fileStats?.deleted, 1);
});

test('parseGitStatusV2 counts worktree-deleted files', () => {
  const output = [
    '# branch.oid abc1234567890',
    '# branch.head main',
    '1 .D N... 100644 100644 000000 abc123 abc123 deleted.txt',
  ].join('\n');

  const result = parseGitStatusV2(output);
  assert.equal(result?.fileStats?.deleted, 1);
});

// --- parseGitStatusV2: rename/copy entries ---

test('parseGitStatusV2 counts rename entry as modified', () => {
  const output = [
    '# branch.oid abc1234567890',
    '# branch.head main',
    '2 R. N... 100644 100644 100644 abc123 abc123 R100 new.txt\told.txt',
  ].join('\n');

  const result = parseGitStatusV2(output);
  assert.equal(result?.fileStats?.modified, 1);
  assert.equal(result?.fileStats?.added, 0);
});

test('parseGitStatusV2 counts copy entry as modified', () => {
  const output = [
    '# branch.oid abc1234567890',
    '# branch.head main',
    '2 C. N... 100644 100644 100644 abc123 abc123 C100 copy.txt\toriginal.txt',
  ].join('\n');

  const result = parseGitStatusV2(output);
  assert.equal(result?.fileStats?.modified, 1);
});

// --- parseGitStatusV2: unmerged entries ---

test('parseGitStatusV2 counts unmerged entries as modified', () => {
  const output = [
    '# branch.oid abc1234567890',
    '# branch.head main',
    'u UU N... 100644 100644 100644 100644 abc123 def456 ghi789 conflict.txt',
  ].join('\n');

  const result = parseGitStatusV2(output);
  assert.equal(result?.isDirty, true);
  assert.equal(result?.fileStats?.modified, 1);
});

// --- parseGitStatusV2: mixed entries ---

test('parseGitStatusV2 counts mixed file types correctly', () => {
  const output = [
    '# branch.oid abc1234567890',
    '# branch.head feature/work',
    '# branch.upstream origin/feature/work',
    '# branch.ab +2 -0',
    '1 M. N... 100644 100644 100644 abc123 def456 modified.txt',
    '1 A. N... 000000 100644 100644 000000 abc123 added.txt',
    '1 D. N... 100644 000000 000000 abc123 000000 deleted.txt',
    '? untracked.txt',
    '2 R. N... 100644 100644 100644 abc123 abc123 R100 renamed.txt\told-name.txt',
  ].join('\n');

  const result = parseGitStatusV2(output);
  assert.equal(result?.branch, 'feature/work');
  assert.equal(result?.isDirty, true);
  assert.equal(result?.ahead, 2);
  assert.equal(result?.behind, 0);
  assert.equal(result?.fileStats?.modified, 2); // M + R
  assert.equal(result?.fileStats?.added, 1);
  assert.equal(result?.fileStats?.deleted, 1);
  assert.equal(result?.fileStats?.untracked, 1);
});

test('parseGitStatusV2 returns undefined fileStats for clean repo', () => {
  const output = [
    '# branch.oid abc1234567890',
    '# branch.head main',
    '# branch.upstream origin/main',
    '# branch.ab +0 -0',
  ].join('\n');

  const result = parseGitStatusV2(output);
  assert.equal(result?.isDirty, false);
  assert.equal(result?.fileStats, undefined);
});

// --- parseGitStatusV2: edge cases ---

test('parseGitStatusV2 handles trailing newline', () => {
  const output = '# branch.oid abc1234567890\n# branch.head main\n';
  const result = parseGitStatusV2(output);
  assert.equal(result?.branch, 'main');
});

test('parseGitStatusV2 ignores unknown header lines', () => {
  const output = [
    '# branch.oid abc1234567890',
    '# branch.head main',
    '# branch.upstream origin/main',
    '# stash 2',
  ].join('\n');

  const result = parseGitStatusV2(output);
  assert.equal(result?.branch, 'main');
});

// --- getGitStatus fallback behavior ---
// These tests verify that getGitStatus still works with real git repos,
// exercising the v2 path (and implicitly the fallback if v2 is unavailable).

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getGitStatus } from '../dist/git.js';

test('getGitStatus returns correct result via v2 path for clean repo', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'claude-hud-v2-'));
  try {
    execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir, stdio: 'ignore' });
    execFileSync('git', ['commit', '--allow-empty', '-m', 'init'], { cwd: dir, stdio: 'ignore' });

    const result = await getGitStatus(dir);
    assert.ok(result?.branch === 'main' || result?.branch === 'master');
    assert.equal(result?.isDirty, false);
    assert.equal(result?.ahead, 0);
    assert.equal(result?.behind, 0);
    assert.equal(result?.fileStats, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('getGitStatus returns correct result via v2 path for dirty repo', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'claude-hud-v2-'));
  try {
    execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir, stdio: 'ignore' });
    execFileSync('git', ['commit', '--allow-empty', '-m', 'init'], { cwd: dir, stdio: 'ignore' });

    await writeFile(path.join(dir, 'newfile.txt'), 'content');

    const result = await getGitStatus(dir);
    assert.equal(result?.isDirty, true);
    assert.equal(result?.fileStats?.untracked, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('getGitStatus handles detached HEAD via v2 path', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'claude-hud-v2-'));
  try {
    execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir, stdio: 'ignore' });
    execFileSync('git', ['commit', '--allow-empty', '-m', 'init'], { cwd: dir, stdio: 'ignore' });

    // Get the commit hash and detach HEAD
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
    execFileSync('git', ['checkout', sha], { cwd: dir, stdio: 'ignore' });

    const result = await getGitStatus(dir);
    assert.ok(result);
    // Should be a 7-char abbreviated sha
    assert.equal(result.branch.length, 7);
    assert.equal(result.branch, sha.slice(0, 7));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
