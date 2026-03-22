import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
export async function getGitBranch(cwd) {
    if (!cwd)
        return null;
    try {
        const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, timeout: 1000, encoding: 'utf8' });
        return stdout.trim() || null;
    }
    catch {
        return null;
    }
}
/**
 * Parse `git status -b --porcelain=v2` output into GitStatus.
 *
 * Header lines:
 *   # branch.head <name>       → branch name (or "(detached)" for detached HEAD)
 *   # branch.oid <sha>         → used as short sha when detached
 *   # branch.ab +N -M          → ahead/behind
 *
 * Entry lines:
 *   1 <XY> ...                 → ordinary changed entry
 *   2 <XY> ...                 → rename/copy entry
 *   u <XY> ...                 → unmerged entry
 *   ? <path>                   → untracked
 */
export function parseGitStatusV2(output) {
    let branch = '';
    let oid = '';
    let ahead = 0;
    let behind = 0;
    const stats = { modified: 0, added: 0, deleted: 0, untracked: 0 };
    let hasEntries = false;
    const lines = output.split('\n');
    for (const line of lines) {
        if (!line)
            continue;
        if (line.startsWith('# branch.head ')) {
            branch = line.slice('# branch.head '.length);
        }
        else if (line.startsWith('# branch.oid ')) {
            oid = line.slice('# branch.oid '.length);
        }
        else if (line.startsWith('# branch.ab ')) {
            const match = line.match(/^# branch\.ab \+(\d+) -(\d+)$/);
            if (match) {
                ahead = parseInt(match[1], 10);
                behind = parseInt(match[2], 10);
            }
        }
        else if (line.startsWith('? ')) {
            hasEntries = true;
            stats.untracked++;
        }
        else if (line.startsWith('u ')) {
            // Unmerged entries count as modified
            hasEntries = true;
            stats.modified++;
        }
        else if (line.startsWith('1 ') || line.startsWith('2 ')) {
            hasEntries = true;
            // XY is at position 2-3 (after "1 " or "2 ")
            const xy = line.slice(2, 4);
            if (xy.length < 2)
                continue;
            const index = xy[0];
            const worktree = xy[1];
            if (index === 'A') {
                stats.added++;
            }
            else if (index === 'D' || worktree === 'D') {
                stats.deleted++;
            }
            else if (index === 'M' || worktree === 'M' || index === 'R' || index === 'C') {
                stats.modified++;
            }
        }
    }
    if (!branch)
        return null;
    // Detached HEAD: use short oid
    if (branch === '(detached)') {
        branch = oid ? oid.slice(0, 7) : 'HEAD';
    }
    const isDirty = hasEntries;
    const fileStats = isDirty ? stats : undefined;
    return { branch, isDirty, ahead, behind, fileStats };
}
export async function getGitStatus(cwd) {
    if (!cwd)
        return null;
    try {
        // Try single-command v2 approach first
        const { stdout } = await execFileAsync('git', ['--no-optional-locks', 'status', '-b', '--porcelain=v2'], { cwd, timeout: 1000, encoding: 'utf8' });
        const result = parseGitStatusV2(stdout);
        if (result)
            return result;
    }
    catch {
        // Fall through to legacy approach
    }
    return getGitStatusLegacy(cwd);
}
/** Legacy 3-command approach as fallback. */
async function getGitStatusLegacy(cwd) {
    try {
        // Get branch name
        const { stdout: branchOut } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, timeout: 1000, encoding: 'utf8' });
        const branch = branchOut.trim();
        if (!branch)
            return null;
        const [statusResult, revResult] = await Promise.all([
            execFileAsync('git', ['--no-optional-locks', 'status', '--porcelain'], { cwd, timeout: 1000, encoding: 'utf8' }).catch(() => null),
            execFileAsync('git', ['rev-list', '--left-right', '--count', '@{upstream}...HEAD'], { cwd, timeout: 1000, encoding: 'utf8' }).catch(() => null),
        ]);
        let isDirty = false;
        let fileStats;
        if (statusResult) {
            const trimmed = statusResult.stdout.trim();
            isDirty = trimmed.length > 0;
            if (isDirty) {
                fileStats = parseFileStats(trimmed);
            }
        }
        let ahead = 0;
        let behind = 0;
        if (revResult) {
            const parts = revResult.stdout.trim().split(/\s+/);
            if (parts.length === 2) {
                behind = parseInt(parts[0], 10) || 0;
                ahead = parseInt(parts[1], 10) || 0;
            }
        }
        return { branch, isDirty, ahead, behind, fileStats };
    }
    catch {
        return null;
    }
}
/**
 * Parse git status --porcelain (v1) output and count file stats.
 * Used by legacy fallback path.
 */
function parseFileStats(porcelainOutput) {
    const stats = { modified: 0, added: 0, deleted: 0, untracked: 0 };
    const lines = porcelainOutput.split('\n').filter(Boolean);
    for (const line of lines) {
        if (line.length < 2)
            continue;
        const index = line[0]; // staged status
        const worktree = line[1]; // unstaged status
        if (line.startsWith('??')) {
            stats.untracked++;
        }
        else if (index === 'A') {
            stats.added++;
        }
        else if (index === 'D' || worktree === 'D') {
            stats.deleted++;
        }
        else if (index === 'M' || worktree === 'M' || index === 'R' || index === 'C') {
            // M=modified, R=renamed (counts as modified), C=copied (counts as modified)
            stats.modified++;
        }
    }
    return stats;
}
//# sourceMappingURL=git.js.map