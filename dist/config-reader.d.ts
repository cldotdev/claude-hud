export interface ConfigCounts {
    claudeMdCount: number;
    rulesCount: number;
    mcpCount: number;
    hooksCount: number;
}
/**
 * Read and parse a JSON file with per-invocation caching.
 * Returns the parsed object, or null if the file does not exist or is invalid.
 * Non-existence is cached too (null stored) so we never stat/read a missing file twice.
 */
export declare function readJsonFileCached(filePath: string, cache: Map<string, Record<string, unknown> | null>): Record<string, unknown> | null;
export declare function countConfigs(cwd?: string): Promise<ConfigCounts>;
//# sourceMappingURL=config-reader.d.ts.map