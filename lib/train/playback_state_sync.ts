/** Whether an SSE train_playback_state event may replace the client window. */
export function shouldApplyPlaybackStateWindow(pendingAdvanceCount: number): boolean {
  return pendingAdvanceCount === 0;
}
