/** Whether an SSE train_playback_state event may replace the client window. */
export function shouldApplyPlaybackStateWindow(
  pendingAdvanceCount: number,
  orchestratorBusy: boolean,
  hasDeferredJump: boolean,
): boolean {
  return pendingAdvanceCount === 0 && !orchestratorBusy && !hasDeferredJump;
}
