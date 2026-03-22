import { DEFAULT_ELEMENT_ORDER } from '../config.js';
import { renderSessionLine } from './session-line.js';
import { renderToolsLine } from './tools-line.js';
import { renderAgentsLine } from './agents-line.js';
import { renderTodosLine } from './todos-line.js';
import { renderIdentityLine, renderProjectLine, renderEnvironmentLine, renderUsageLine, } from './lines/index.js';
import { dim, RESET } from './colors.js';
import { getTerminalWidth } from '../utils/terminal.js';
// Matches ANSI escape sequences or runs of non-escape text in a single pass.
// eslint-disable-next-line no-control-regex
const ANSI_OR_TEXT = /(\x1b\[[0-9;]*m)|([^\x1b]+)/g;
// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE_GLOBAL = /\x1b\[[0-9;]*m/g;
// eslint-disable-next-line no-control-regex
const ANSI_AT_POS = /\x1b\[[0-9;]*m/y;
const CONTROL_RE = /^\p{Control}$/u;
const PICTOGRAPHIC_RE = /\p{Extended_Pictographic}/u;
const MARK_RE = /^\p{Mark}$/u;
const GRAPHEME_SEGMENTER = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;
function stripAnsi(str) {
    return str.replace(ANSI_ESCAPE_GLOBAL, '');
}
function splitAnsiTokens(str) {
    const tokens = [];
    for (const m of str.matchAll(ANSI_OR_TEXT)) {
        if (m[1] !== undefined) {
            tokens.push({ type: 'ansi', value: m[1] });
        }
        else if (m[2] !== undefined) {
            tokens.push({ type: 'text', value: m[2] });
        }
    }
    return tokens;
}
function segmentGraphemes(text) {
    if (!text) {
        return [];
    }
    if (!GRAPHEME_SEGMENTER) {
        return Array.from(text);
    }
    return Array.from(GRAPHEME_SEGMENTER.segment(text), segment => segment.segment);
}
function isWideCodePoint(codePoint) {
    return codePoint >= 0x1100 && (codePoint <= 0x115F || // Hangul Jamo
        codePoint === 0x2329 ||
        codePoint === 0x232A ||
        (codePoint >= 0x2E80 && codePoint <= 0xA4CF && codePoint !== 0x303F) ||
        (codePoint >= 0xAC00 && codePoint <= 0xD7A3) ||
        (codePoint >= 0xF900 && codePoint <= 0xFAFF) ||
        (codePoint >= 0xFE10 && codePoint <= 0xFE19) ||
        (codePoint >= 0xFE30 && codePoint <= 0xFE6F) ||
        (codePoint >= 0xFF00 && codePoint <= 0xFF60) ||
        (codePoint >= 0xFFE0 && codePoint <= 0xFFE6) ||
        (codePoint >= 0x1F300 && codePoint <= 0x1FAFF) ||
        (codePoint >= 0x20000 && codePoint <= 0x3FFFD));
}
function graphemeWidth(grapheme) {
    if (!grapheme || CONTROL_RE.test(grapheme)) {
        return 0;
    }
    if (PICTOGRAPHIC_RE.test(grapheme)) {
        return 2;
    }
    let hasVisibleBase = false;
    let width = 0;
    for (const char of Array.from(grapheme)) {
        if (MARK_RE.test(char) || char === '\u200D' || char === '\uFE0F') {
            continue;
        }
        hasVisibleBase = true;
        const codePoint = char.codePointAt(0);
        if (codePoint !== undefined && isWideCodePoint(codePoint)) {
            width = Math.max(width, 2);
        }
        else {
            width = Math.max(width, 1);
        }
    }
    return hasVisibleBase ? width : 0;
}
function visualLength(str) {
    let width = 0;
    for (const token of splitAnsiTokens(str)) {
        if (token.type === 'ansi') {
            continue;
        }
        for (const grapheme of segmentGraphemes(token.value)) {
            width += graphemeWidth(grapheme);
        }
    }
    return width;
}
function sliceVisible(str, maxVisible) {
    if (maxVisible <= 0) {
        return '';
    }
    let result = '';
    let visibleWidth = 0;
    for (const m of str.matchAll(ANSI_OR_TEXT)) {
        if (m[1] !== undefined) {
            // ANSI escape -- pass through without counting width
            result += m[1];
            continue;
        }
        // Text run
        const text = m[2];
        for (const grapheme of segmentGraphemes(text)) {
            const graphemeCellWidth = graphemeWidth(grapheme);
            if (visibleWidth + graphemeCellWidth > maxVisible) {
                return result;
            }
            result += grapheme;
            visibleWidth += graphemeCellWidth;
        }
    }
    return result;
}
function truncateToWidth(str, maxWidth) {
    if (maxWidth <= 0) {
        return str;
    }
    // Single-pass: measure total visible width while accumulating the
    // sliced-to-keep prefix.  If the string fits, return it as-is without
    // ever building the truncated version.
    const suffix = maxWidth >= 3 ? '...' : '.'.repeat(maxWidth);
    const keep = Math.max(0, maxWidth - suffix.length);
    let totalWidth = 0;
    let keepResult = '';
    let keepWidth = 0;
    let keepDone = false;
    for (const m of str.matchAll(ANSI_OR_TEXT)) {
        if (m[1] !== undefined) {
            // ANSI escape -- zero width, always include in keepResult
            if (!keepDone) {
                keepResult += m[1];
            }
            continue;
        }
        const text = m[2];
        for (const grapheme of segmentGraphemes(text)) {
            const w = graphemeWidth(grapheme);
            totalWidth += w;
            if (!keepDone) {
                if (keepWidth + w > keep) {
                    keepDone = true;
                }
                else {
                    keepResult += grapheme;
                    keepWidth += w;
                }
            }
            if (keepDone && totalWidth > maxWidth) {
                return `${keepResult}${suffix}${RESET}`;
            }
        }
    }
    if (totalWidth <= maxWidth) {
        return str;
    }
    return `${keepResult}${suffix}${RESET}`;
}
function splitLineBySeparators(line) {
    const segments = [];
    const separators = [];
    let currentStart = 0;
    let i = 0;
    while (i < line.length) {
        // Use sticky regex to check for ANSI escape at current position
        ANSI_AT_POS.lastIndex = i;
        const ansiMatch = ANSI_AT_POS.exec(line);
        if (ansiMatch) {
            i = ANSI_AT_POS.lastIndex;
            continue;
        }
        // Check for separator patterns by comparing characters directly.
        // ' | ' is 3 chars; ' \u2502 ' is 5 bytes but 3 code points.
        if (line.charCodeAt(i) === 0x20 /* space */) {
            if (line.charCodeAt(i + 1) === 0x7C /* | */ &&
                line.charCodeAt(i + 2) === 0x20 /* space */) {
                segments.push(line.slice(currentStart, i));
                separators.push(' | ');
                i += 3;
                currentStart = i;
                continue;
            }
            if (line.charCodeAt(i + 1) === 0x2502 /* │ */ &&
                line.charCodeAt(i + 2) === 0x20 /* space */) {
                segments.push(line.slice(currentStart, i));
                separators.push(' │ ');
                i += 3;
                currentStart = i;
                continue;
            }
        }
        i += 1;
    }
    segments.push(line.slice(currentStart));
    return { segments, separators };
}
function splitWrapParts(line) {
    const { segments, separators } = splitLineBySeparators(line);
    if (segments.length === 0) {
        return [];
    }
    let parts = [{
            separator: '',
            segment: segments[0],
        }];
    for (let segmentIndex = 1; segmentIndex < segments.length; segmentIndex += 1) {
        parts.push({
            separator: separators[segmentIndex - 1] ?? ' | ',
            segment: segments[segmentIndex],
        });
    }
    // Keep the leading [model | provider] block together.
    // This avoids splitting inside the model badge while still splitting
    // separators elsewhere in the line.
    const firstVisible = stripAnsi(parts[0].segment).trimStart();
    const firstHasOpeningBracket = firstVisible.startsWith('[');
    const firstHasClosingBracket = stripAnsi(parts[0].segment).includes(']');
    if (firstHasOpeningBracket && !firstHasClosingBracket && parts.length > 1) {
        let mergedSegment = parts[0].segment;
        let consumeIndex = 1;
        while (consumeIndex < parts.length) {
            const nextPart = parts[consumeIndex];
            mergedSegment += `${nextPart.separator}${nextPart.segment}`;
            consumeIndex += 1;
            if (stripAnsi(nextPart.segment).includes(']')) {
                break;
            }
        }
        parts = [
            { separator: '', segment: mergedSegment },
            ...parts.slice(consumeIndex),
        ];
    }
    return parts;
}
function wrapLineToWidth(line, maxWidth) {
    if (maxWidth <= 0 || visualLength(line) <= maxWidth) {
        return [line];
    }
    const parts = splitWrapParts(line);
    if (parts.length <= 1) {
        return [truncateToWidth(line, maxWidth)];
    }
    const wrapped = [];
    let current = parts[0].segment;
    for (const part of parts.slice(1)) {
        const candidate = `${current}${part.separator}${part.segment}`;
        if (visualLength(candidate) <= maxWidth) {
            current = candidate;
            continue;
        }
        wrapped.push(truncateToWidth(current, maxWidth));
        current = part.segment;
    }
    if (current) {
        wrapped.push(truncateToWidth(current, maxWidth));
    }
    return wrapped;
}
function makeSeparator(length) {
    return dim('─'.repeat(Math.max(length, 1)));
}
const ACTIVITY_ELEMENTS = new Set(['tools', 'agents', 'todos']);
function collectActivityLines(ctx) {
    return [...ACTIVITY_ELEMENTS]
        .map(el => renderElementLine(ctx, el))
        .filter((line) => line !== null);
}
function renderElementLine(ctx, element) {
    const display = ctx.config?.display;
    switch (element) {
        case 'project':
            return renderProjectLine(ctx);
        case 'context':
            return renderIdentityLine(ctx);
        case 'usage':
            return renderUsageLine(ctx);
        case 'environment':
            return renderEnvironmentLine(ctx);
        case 'tools':
            return display?.showTools === false ? null : renderToolsLine(ctx);
        case 'agents':
            return display?.showAgents === false ? null : renderAgentsLine(ctx);
        case 'todos':
            return display?.showTodos === false ? null : renderTodosLine(ctx);
    }
}
function renderCompact(ctx) {
    const lines = [];
    const sessionLine = renderSessionLine(ctx);
    if (sessionLine) {
        lines.push(sessionLine);
    }
    return lines;
}
function renderExpanded(ctx) {
    const elementOrder = ctx.config?.elementOrder ?? DEFAULT_ELEMENT_ORDER;
    const seen = new Set();
    const lines = [];
    for (let index = 0; index < elementOrder.length; index += 1) {
        const element = elementOrder[index];
        if (seen.has(element)) {
            continue;
        }
        const nextElement = elementOrder[index + 1];
        if ((element === 'context' && nextElement === 'usage' && !seen.has('usage'))
            || (element === 'usage' && nextElement === 'context' && !seen.has('context'))) {
            seen.add(element);
            seen.add(nextElement);
            const firstLine = renderElementLine(ctx, element);
            const secondLine = renderElementLine(ctx, nextElement);
            if (firstLine && secondLine) {
                lines.push({ line: `${firstLine} │ ${secondLine}`, isActivity: false });
            }
            else if (firstLine) {
                lines.push({ line: firstLine, isActivity: false });
            }
            else if (secondLine) {
                lines.push({ line: secondLine, isActivity: false });
            }
            continue;
        }
        seen.add(element);
        const line = renderElementLine(ctx, element);
        if (!line) {
            continue;
        }
        lines.push({
            line,
            isActivity: ACTIVITY_ELEMENTS.has(element),
        });
    }
    return lines;
}
export function render(ctx) {
    const lineLayout = ctx.config?.lineLayout ?? 'expanded';
    const showSeparators = ctx.config?.showSeparators ?? false;
    const terminalWidth = getTerminalWidth();
    let lines;
    if (lineLayout === 'expanded') {
        const renderedLines = renderExpanded(ctx);
        lines = renderedLines.map(({ line }) => line);
        if (showSeparators) {
            const firstActivityIndex = renderedLines.findIndex(({ isActivity }) => isActivity);
            if (firstActivityIndex > 0) {
                const separatorBaseWidth = Math.max(...renderedLines
                    .slice(0, firstActivityIndex)
                    .map(({ line }) => visualLength(line)), 20);
                const separatorWidth = terminalWidth
                    ? Math.min(separatorBaseWidth, terminalWidth)
                    : separatorBaseWidth;
                lines.splice(firstActivityIndex, 0, makeSeparator(separatorWidth));
            }
        }
    }
    else {
        const headerLines = renderCompact(ctx);
        const activityLines = collectActivityLines(ctx);
        lines = [...headerLines];
        if (showSeparators && activityLines.length > 0) {
            const maxWidth = Math.max(...headerLines.map(visualLength), 20);
            const separatorWidth = terminalWidth ? Math.min(maxWidth, terminalWidth) : maxWidth;
            lines.push(makeSeparator(separatorWidth));
        }
        lines.push(...activityLines);
    }
    const physicalLines = lines.flatMap(line => line.split('\n'));
    const visibleLines = terminalWidth
        ? physicalLines.flatMap(line => wrapLineToWidth(line, terminalWidth))
        : physicalLines;
    for (const line of visibleLines) {
        const outputLine = `${RESET}${line}`;
        console.log(outputLine);
    }
}
export { splitAnsiTokens, visualLength, sliceVisible, splitLineBySeparators, truncateToWidth };
//# sourceMappingURL=index.js.map