import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createDebug } from './debug.js';
import { getClaudeConfigDir, getClaudeConfigJsonPath } from './claude-config-dir.js';
const debug = createDebug('config');
/**
 * Read and parse a JSON file with per-invocation caching.
 * Returns the parsed object, or null if the file does not exist or is invalid.
 * Non-existence is cached too (null stored) so we never stat/read a missing file twice.
 */
export function readJsonFileCached(filePath, cache) {
    if (cache.has(filePath)) {
        return cache.get(filePath);
    }
    let result = null;
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            result = parsed;
        }
    }
    catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
            debug(`Failed to read/parse ${filePath}:`, error);
        }
    }
    cache.set(filePath, result);
    return result;
}
function getMcpServerNamesFromConfig(config) {
    if (!config)
        return new Set();
    if (config.mcpServers && typeof config.mcpServers === 'object') {
        return new Set(Object.keys(config.mcpServers));
    }
    return new Set();
}
function getDisabledMcpServersFromConfig(config, key, label) {
    if (!config)
        return new Set();
    if (Array.isArray(config[key])) {
        const arr = config[key];
        const validNames = arr.filter((s) => typeof s === 'string');
        if (validNames.length !== arr.length) {
            debug(`${key} in ${label} contains non-string values, ignoring them`);
        }
        return new Set(validNames);
    }
    return new Set();
}
function countHooksFromConfig(config) {
    if (!config)
        return 0;
    if (config.hooks && typeof config.hooks === 'object') {
        return Object.keys(config.hooks).length;
    }
    return 0;
}
function countRulesInDir(rulesDir) {
    if (!fs.existsSync(rulesDir))
        return 0;
    let count = 0;
    try {
        const entries = fs.readdirSync(rulesDir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(rulesDir, entry.name);
            if (entry.isDirectory()) {
                count += countRulesInDir(fullPath);
            }
            else if (entry.isFile() && entry.name.endsWith('.md')) {
                count++;
            }
        }
    }
    catch (error) {
        debug(`Failed to read rules from ${rulesDir}:`, error);
    }
    return count;
}
function normalizePathForComparison(inputPath) {
    let normalized = path.normalize(path.resolve(inputPath));
    const root = path.parse(normalized).root;
    while (normalized.length > root.length && normalized.endsWith(path.sep)) {
        normalized = normalized.slice(0, -1);
    }
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}
function pathsReferToSameLocation(pathA, pathB) {
    if (normalizePathForComparison(pathA) === normalizePathForComparison(pathB)) {
        return true;
    }
    if (!fs.existsSync(pathA) || !fs.existsSync(pathB)) {
        return false;
    }
    try {
        const realPathA = fs.realpathSync.native(pathA);
        const realPathB = fs.realpathSync.native(pathB);
        return normalizePathForComparison(realPathA) === normalizePathForComparison(realPathB);
    }
    catch {
        return false;
    }
}
export async function countConfigs(cwd) {
    let claudeMdCount = 0;
    let rulesCount = 0;
    let hooksCount = 0;
    const homeDir = os.homedir();
    const claudeDir = getClaudeConfigDir(homeDir);
    // Per-invocation cache: each JSON config file is read at most once
    const cache = new Map();
    // Collect all MCP servers across scopes, then subtract disabled ones
    const userMcpServers = new Set();
    const projectMcpServers = new Set();
    // === USER SCOPE ===
    // ~/.claude/CLAUDE.md
    if (fs.existsSync(path.join(claudeDir, 'CLAUDE.md'))) {
        claudeMdCount++;
    }
    // ~/.claude/rules/*.md
    rulesCount += countRulesInDir(path.join(claudeDir, 'rules'));
    // ~/.claude/settings.json (MCPs and hooks)
    const userSettingsPath = path.join(claudeDir, 'settings.json');
    const userSettingsConfig = readJsonFileCached(userSettingsPath, cache);
    for (const name of getMcpServerNamesFromConfig(userSettingsConfig)) {
        userMcpServers.add(name);
    }
    hooksCount += countHooksFromConfig(userSettingsConfig);
    // {CLAUDE_CONFIG_DIR}.json (additional user-scope MCPs)
    const userClaudeJsonPath = getClaudeConfigJsonPath(homeDir);
    const userClaudeJsonConfig = readJsonFileCached(userClaudeJsonPath, cache);
    for (const name of getMcpServerNamesFromConfig(userClaudeJsonConfig)) {
        userMcpServers.add(name);
    }
    // Get disabled user-scope MCPs from ~/.claude.json
    const disabledUserMcps = getDisabledMcpServersFromConfig(userClaudeJsonConfig, 'disabledMcpServers', userClaudeJsonPath);
    for (const name of disabledUserMcps) {
        userMcpServers.delete(name);
    }
    // === PROJECT SCOPE ===
    // Avoid double-counting when project .claude directory is the same location as user scope.
    const projectClaudeDir = cwd ? path.join(cwd, '.claude') : null;
    const projectClaudeOverlapsUserScope = projectClaudeDir
        ? pathsReferToSameLocation(projectClaudeDir, claudeDir)
        : false;
    if (cwd) {
        // {cwd}/CLAUDE.md
        if (fs.existsSync(path.join(cwd, 'CLAUDE.md'))) {
            claudeMdCount++;
        }
        // {cwd}/CLAUDE.local.md
        if (fs.existsSync(path.join(cwd, 'CLAUDE.local.md'))) {
            claudeMdCount++;
        }
        // {cwd}/.claude/CLAUDE.md (alternative location, skip when it is user scope)
        if (!projectClaudeOverlapsUserScope && fs.existsSync(path.join(cwd, '.claude', 'CLAUDE.md'))) {
            claudeMdCount++;
        }
        // {cwd}/.claude/CLAUDE.local.md
        if (fs.existsSync(path.join(cwd, '.claude', 'CLAUDE.local.md'))) {
            claudeMdCount++;
        }
        // {cwd}/.claude/rules/*.md (recursive)
        // Skip when it overlaps with user-scope rules.
        if (!projectClaudeOverlapsUserScope) {
            rulesCount += countRulesInDir(path.join(cwd, '.claude', 'rules'));
        }
        // {cwd}/.mcp.json (project MCP config) - tracked separately for disabled filtering
        const mcpJsonPath = path.join(cwd, '.mcp.json');
        const mcpJsonConfig = readJsonFileCached(mcpJsonPath, cache);
        const mcpJsonServers = getMcpServerNamesFromConfig(mcpJsonConfig);
        // {cwd}/.claude/settings.json (project settings)
        // Skip when it overlaps with user-scope settings.
        const projectSettingsPath = path.join(cwd, '.claude', 'settings.json');
        if (!projectClaudeOverlapsUserScope) {
            const projectSettingsConfig = readJsonFileCached(projectSettingsPath, cache);
            for (const name of getMcpServerNamesFromConfig(projectSettingsConfig)) {
                projectMcpServers.add(name);
            }
            hooksCount += countHooksFromConfig(projectSettingsConfig);
        }
        // {cwd}/.claude/settings.local.json (local project settings)
        const localSettingsPath = path.join(cwd, '.claude', 'settings.local.json');
        const localSettingsConfig = readJsonFileCached(localSettingsPath, cache);
        for (const name of getMcpServerNamesFromConfig(localSettingsConfig)) {
            projectMcpServers.add(name);
        }
        hooksCount += countHooksFromConfig(localSettingsConfig);
        // Get disabled .mcp.json servers from settings.local.json
        const disabledMcpJsonServers = getDisabledMcpServersFromConfig(localSettingsConfig, 'disabledMcpjsonServers', localSettingsPath);
        for (const name of disabledMcpJsonServers) {
            mcpJsonServers.delete(name);
        }
        // Add remaining .mcp.json servers to project set
        for (const name of mcpJsonServers) {
            projectMcpServers.add(name);
        }
    }
    // Total MCP count = user servers + project servers
    // Note: Deduplication only occurs within each scope, not across scopes.
    // A server with the same name in both user and project scope counts as 2 (separate configs).
    const mcpCount = userMcpServers.size + projectMcpServers.size;
    return { claudeMdCount, rulesCount, mcpCount, hooksCount };
}
//# sourceMappingURL=config-reader.js.map