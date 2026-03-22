import * as fs from 'fs';
import * as readline from 'readline';
/** Files larger than this use tail-read strategy */
export const TAIL_THRESHOLD = 256 * 1024; // 256KB
/** How many bytes to read from the end of large files */
export const TAIL_SIZE = 64 * 1024; // 64KB
export async function parseTranscript(transcriptPath) {
    const state = {
        result: { tools: [], agents: [], todos: [] },
        toolMap: new Map(),
        agentMap: new Map(),
        taskIdToIndex: new Map(),
        latestTodos: [],
    };
    if (!transcriptPath)
        return state.result;
    let latestSlug;
    let customTitle;
    const updateMeta = (entry) => {
        if (entry.type === 'custom-title' && typeof entry.customTitle === 'string') {
            customTitle = entry.customTitle;
        }
        else if (typeof entry.slug === 'string') {
            latestSlug = entry.slug;
        }
    };
    try {
        const stat = fs.statSync(transcriptPath);
        if (stat.size > TAIL_THRESHOLD) {
            parseLargeFile(transcriptPath, stat.size, state, updateMeta);
        }
        else {
            const fileStream = fs.createReadStream(transcriptPath);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity,
            });
            for await (const line of rl) {
                if (!line.trim())
                    continue;
                try {
                    const entry = JSON.parse(line);
                    updateMeta(entry);
                    processEntry(entry, state);
                }
                catch {
                    // Skip malformed lines
                }
            }
        }
    }
    catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            return state.result;
        }
        // Return partial results on other errors
    }
    state.result.tools = Array.from(state.toolMap.values()).slice(-20);
    state.result.agents = Array.from(state.agentMap.values()).slice(-10);
    state.result.todos = state.latestTodos;
    state.result.sessionName = customTitle ?? latestSlug;
    return state.result;
}
/**
 * Parse a large transcript file by reading just the first line (for sessionStart)
 * and the last TAIL_SIZE bytes (for recent tool/agent/todo activity).
 */
function parseLargeFile(filePath, fileSize, state, onMeta) {
    const fd = fs.openSync(filePath, 'r');
    try {
        // Read first line for sessionStart
        const firstLineBuffer = Buffer.allocUnsafe(4096);
        const firstReadBytes = fs.readSync(fd, firstLineBuffer, 0, 4096, 0);
        const firstChunk = firstLineBuffer.subarray(0, firstReadBytes).toString('utf-8');
        const newlineIndex = firstChunk.indexOf('\n');
        const firstLine = newlineIndex >= 0 ? firstChunk.slice(0, newlineIndex) : firstChunk;
        if (firstLine.trim()) {
            try {
                const entry = JSON.parse(firstLine);
                if (entry.timestamp) {
                    state.result.sessionStart = new Date(entry.timestamp);
                }
                onMeta(entry);
            }
            catch {
                // Skip malformed first line
            }
        }
        // Read tail for recent entries
        const tailStart = Math.max(0, fileSize - TAIL_SIZE);
        const tailLength = fileSize - tailStart;
        const tailBuffer = Buffer.allocUnsafe(tailLength);
        fs.readSync(fd, tailBuffer, 0, tailLength, tailStart);
        const tailText = tailBuffer.toString('utf-8');
        const tailLines = tailText.split('\n');
        // Skip the first line of the tail — likely a partial line
        const startIndex = tailStart > 0 ? 1 : 0;
        for (let i = startIndex; i < tailLines.length; i++) {
            const line = tailLines[i].trim();
            if (!line)
                continue;
            try {
                const entry = JSON.parse(line);
                onMeta(entry);
                processEntry(entry, state);
            }
            catch {
                // Skip malformed lines
            }
        }
    }
    finally {
        fs.closeSync(fd);
    }
}
function processEntry(entry, state) {
    const { result, toolMap, agentMap, taskIdToIndex, latestTodos } = state;
    if (!result.sessionStart && entry.timestamp) {
        result.sessionStart = new Date(entry.timestamp);
    }
    const content = entry.message?.content;
    if (!content || !Array.isArray(content))
        return;
    let timestamp;
    const getTimestamp = () => {
        if (!timestamp) {
            timestamp = entry.timestamp ? new Date(entry.timestamp) : new Date();
        }
        return timestamp;
    };
    for (const block of content) {
        if (block.type === 'tool_use' && block.id && block.name) {
            const toolEntry = {
                id: block.id,
                name: block.name,
                target: extractTarget(block.name, block.input),
                status: 'running',
                startTime: getTimestamp(),
            };
            if (block.name === 'Task') {
                const input = block.input;
                const agentEntry = {
                    id: block.id,
                    type: input?.subagent_type ?? 'unknown',
                    model: input?.model ?? undefined,
                    description: input?.description ?? undefined,
                    status: 'running',
                    startTime: getTimestamp(),
                };
                agentMap.set(block.id, agentEntry);
            }
            else if (block.name === 'TodoWrite') {
                const input = block.input;
                if (input?.todos && Array.isArray(input.todos)) {
                    latestTodos.length = 0;
                    taskIdToIndex.clear();
                    latestTodos.push(...input.todos);
                }
            }
            else if (block.name === 'TaskCreate') {
                const input = block.input;
                const subject = typeof input?.subject === 'string' ? input.subject : '';
                const description = typeof input?.description === 'string' ? input.description : '';
                const content = subject || description || 'Untitled task';
                const status = normalizeTaskStatus(input?.status) ?? 'pending';
                latestTodos.push({ content, status });
                const rawTaskId = input?.taskId;
                const taskId = typeof rawTaskId === 'string' || typeof rawTaskId === 'number'
                    ? String(rawTaskId)
                    : block.id;
                if (taskId) {
                    taskIdToIndex.set(taskId, latestTodos.length - 1);
                }
            }
            else if (block.name === 'TaskUpdate') {
                const input = block.input;
                const index = resolveTaskIndex(input?.taskId, taskIdToIndex, latestTodos);
                if (index !== null) {
                    const status = normalizeTaskStatus(input?.status);
                    if (status) {
                        latestTodos[index].status = status;
                    }
                    const subject = typeof input?.subject === 'string' ? input.subject : '';
                    const description = typeof input?.description === 'string' ? input.description : '';
                    const content = subject || description;
                    if (content) {
                        latestTodos[index].content = content;
                    }
                }
            }
            else {
                toolMap.set(block.id, toolEntry);
            }
        }
        if (block.type === 'tool_result' && block.tool_use_id) {
            const tool = toolMap.get(block.tool_use_id);
            if (tool) {
                tool.status = block.is_error ? 'error' : 'completed';
                tool.endTime = getTimestamp();
            }
            const agent = agentMap.get(block.tool_use_id);
            if (agent) {
                agent.status = 'completed';
                agent.endTime = getTimestamp();
            }
        }
    }
}
function extractTarget(toolName, input) {
    if (!input)
        return undefined;
    switch (toolName) {
        case 'Read':
        case 'Write':
        case 'Edit':
            return input.file_path ?? input.path;
        case 'Glob':
            return input.pattern;
        case 'Grep':
            return input.pattern;
        case 'Bash': {
            const cmd = input.command;
            if (!cmd)
                return undefined;
            return cmd.slice(0, 30) + (cmd.length > 30 ? '...' : '');
        }
    }
    return undefined;
}
function resolveTaskIndex(taskId, taskIdToIndex, latestTodos) {
    if (typeof taskId === 'string' || typeof taskId === 'number') {
        const key = String(taskId);
        const mapped = taskIdToIndex.get(key);
        if (typeof mapped === 'number') {
            return mapped;
        }
        if (/^\d+$/.test(key)) {
            const numericIndex = Number.parseInt(key, 10) - 1;
            if (numericIndex >= 0 && numericIndex < latestTodos.length) {
                return numericIndex;
            }
        }
    }
    return null;
}
function normalizeTaskStatus(status) {
    if (typeof status !== 'string')
        return null;
    switch (status) {
        case 'pending':
        case 'not_started':
            return 'pending';
        case 'in_progress':
        case 'running':
            return 'in_progress';
        case 'completed':
        case 'complete':
        case 'done':
            return 'completed';
        default:
            return null;
    }
}
//# sourceMappingURL=transcript.js.map