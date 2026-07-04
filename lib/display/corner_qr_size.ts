/** Corner QR sizing for the display join bar (issue #22). */

/** Below this the code is unlikely to scan from a distance; hide instead. */
export const CORNER_QR_MIN_PX = 72;
export const CORNER_QR_MAX_PX = 220;
/** Reserved gap between the bar (incl. its padding) and the cabins/tracks. */
export const CORNER_QR_CLEARANCE_PX = 44;

/**
 * Size the corner QR from the free space between the viewport edge and the
 * train assembly. Returns 0 (hide) when the result would be unscannably
 * small, guaranteeing the bar + QR never encroach on the cabins.
 */
export function computeCornerQrSize(freeSpacePx: number): number {
  if (!Number.isFinite(freeSpacePx)) return 0;
  const size = Math.floor(freeSpacePx - CORNER_QR_CLEARANCE_PX);
  if (size < CORNER_QR_MIN_PX) return 0;
  return Math.min(size, CORNER_QR_MAX_PX);
}
