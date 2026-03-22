export interface FileStats {
    modified: number;
    added: number;
    deleted: number;
    untracked: number;
}
export interface GitStatus {
    branch: string;
    isDirty: boolean;
    ahead: number;
    behind: number;
    fileStats?: FileStats;
}
export declare function getGitBranch(cwd?: string): Promise<string | null>;
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
export declare function parseGitStatusV2(output: string): GitStatus | null;
export declare function getGitStatus(cwd?: string): Promise<GitStatus | null>;
//# sourceMappingURL=git.d.ts.map