/** Visible slots on each side of the centered cabin (fixed for all displays). */
export const VIEWPORT_K = 2;

/** Logical visible slot count: center + K left + K right. */
export const VISIBLE_SLOT_COUNT = VIEWPORT_K * 2 + 1;

/** Off-screen cabins generated past the right edge (slide target + image preload). */
export const PRELOAD_AHEAD = 2;

/** Render window: cabins kept to the left of center (discard farther left). */
export const LEFT_RENDER = VIEWPORT_K;

/** Render window: forward buffer to the right of center (visible K + preload). */
export const RIGHT_RENDER = VIEWPORT_K + PRELOAD_AHEAD;

/** Total cabins in the generated window (tape length). */
export const WINDOW_LENGTH = LEFT_RENDER + 1 + RIGHT_RENDER;

/** Index of the centered cabin within the window. */
export const CENTER_SLOT = LEFT_RENDER;
