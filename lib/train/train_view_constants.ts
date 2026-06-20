/** Visible slots on each side of the centered cabin (fixed for all displays). */
export const VIEWPORT_K = 4;

/** Logical visible slot count: center + K left + K right. */
export const VISIBLE_SLOT_COUNT = VIEWPORT_K * 2 + 1;

/** Render window: cabins kept to the left of center (discard farther left). */
export const LEFT_RENDER = VIEWPORT_K;

/** Render window: forward buffer to the right of center (slide target + preload). */
export const RIGHT_RENDER = VIEWPORT_K * 2 + 2;
