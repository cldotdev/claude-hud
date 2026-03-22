import type { TranscriptData } from './types.js';
/** Files larger than this use tail-read strategy */
export declare const TAIL_THRESHOLD: number;
/** How many bytes to read from the end of large files */
export declare const TAIL_SIZE: number;
export declare function parseTranscript(transcriptPath: string): Promise<TranscriptData>;
//# sourceMappingURL=transcript.d.ts.map