import type { RenderContext } from '../types.js';
declare function splitAnsiTokens(str: string): Array<{
    type: 'ansi' | 'text';
    value: string;
}>;
declare function visualLength(str: string): number;
declare function sliceVisible(str: string, maxVisible: number): string;
declare function truncateToWidth(str: string, maxWidth: number): string;
declare function splitLineBySeparators(line: string): {
    segments: string[];
    separators: string[];
};
export declare function render(ctx: RenderContext): void;
export { splitAnsiTokens, visualLength, sliceVisible, splitLineBySeparators, truncateToWidth };
//# sourceMappingURL=index.d.ts.map