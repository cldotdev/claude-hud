export function getTerminalWidth(): number | null {
  const stdoutCols = process.stdout?.columns;
  if (typeof stdoutCols === 'number' && Number.isFinite(stdoutCols) && stdoutCols > 0) {
    return Math.floor(stdoutCols);
  }

  const stderrCols = process.stderr?.columns;
  if (typeof stderrCols === 'number' && Number.isFinite(stderrCols) && stderrCols > 0) {
    return Math.floor(stderrCols);
  }

  const envCols = Number.parseInt(process.env.COLUMNS ?? '', 10);
  if (Number.isFinite(envCols) && envCols > 0) {
    return envCols;
  }

  return null;
}

// Returns a progress bar width scaled to the current terminal width.
// Wide (>=100): 10, Medium (60-99): 6, Narrow (<60): 4. Defaults to 10.
export function getAdaptiveBarWidth(): number {
  const rawCols = getTerminalWidth();
  if (rawCols !== null) {
    if (rawCols >= 100) return 10;
    if (rawCols >= 60) return 6;
    return 4;
  }
  return 10;
}
