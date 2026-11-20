/** Approximate Margaret Court Arena row dimensions in metres. */
export const mcaLowerRows = 13;
const upperRows = 9;

export function mcaRow(row: number) {
  const upper = row >= mcaLowerRows;
  const index = upper ? row - mcaLowerRows : row;
  const run = upper ? 0.66 : 0.80;
  const depthRun = upper ? 0.49 : 0.58;
  const rise = upper ? 0.54 : 0.48;

  // Anchor the lower bank at the court and the upper bank at the outer wall.
  const innerWidth = (upper ? 32 - upperRows * run : 13) + index * run;
  const innerDepth = (upper ? 36 - upperRows * depthRun : 22) + index * depthRun;
  const top = (upper ? 8.9 : 0.83) + index * rise;
  const radius = 3 + (innerWidth - 13) * 8 / 19;
  return { innerWidth, innerDepth, run, depthRun, rise, top, radius };
}
