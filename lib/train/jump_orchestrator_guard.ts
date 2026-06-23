import type { TrainCommand } from "../interfaces/realtime_service.ts";

/** Whether an incoming jump SSE should be deferred until the client orchestrator is idle. */
export function shouldDeferJumpSse(orchestratorBusy: boolean): boolean {
  return orchestratorBusy;
}

/** Replace deferred jump with the latest command (latest wins). */
export function deferJumpCommand(
  _current: TrainCommand | null,
  incoming: TrainCommand,
): TrainCommand {
  return incoming;
}

/** Take deferred jump for enqueue, or null when none pending. */
export function takeDeferredJump(
  deferred: TrainCommand | null,
): TrainCommand | null {
  if (!deferred || deferred.type !== "jump" || !deferred.window) return null;
  return deferred;
}

/** Drop queued jumps before enqueueing a deferred jump; keep advances. */
export function pendingWithoutJumps<T extends { kind: "advance" | "jump" }>(
  pending: T[],
): T[] {
  return pending.filter((p) => p.kind !== "jump");
}
