import type { TrainCommand, TrainStep } from "../interfaces/realtime_service.ts";
import { clampDwellSeconds } from "./display_helpers.ts";
import { CENTER_SLOT, LEFT_RENDER, RIGHT_RENDER, WINDOW_LENGTH } from "./train_view_constants.ts";

export interface TrainPlaybackState {
  isPlaying: boolean;
  currentCabin: number;
  dwellSeconds: number;
  lastTransitionAt: number;
  cabinCount: number;
  /** Server-authoritative window of generated cabins (FR-20a generator model). */
  window: TrainStep[];
}

export interface TrainPlaybackControllerDeps {
  publish: (command: TrainCommand) => void;
  now?: () => number;
  schedule?: (fn: () => void, delayMs: number) => void;
  cancelSchedule?: () => void;
}

type QueuedEphemeral = { kind: "qr" } | { kind: "post"; submissionId: string };

/**
 * Server-authoritative train generator (FR-20a / FR-22).
 *
 * The canonical sequence is the ordered list of approved submission ids, walked
 * forward with wraparound. Each dwell tick emits ONE cabin at the right edge of a
 * fixed-length window (`WINDOW_LENGTH`): the front of the ephemeral FIFO queue if
 * present (approved previews + QR cabins), otherwise the next sequential post.
 * The full window is broadcast every tick so all displays stay in lockstep and
 * late-joiners/refreshes restore exactly (FR-24a / NFR-11). Ephemerals enter from
 * the right and fall off the left strictly outside the visible band.
 */
export class TrainPlaybackController {
  private readonly publish: (command: TrainCommand) => void;
  private readonly now: () => number;
  private readonly scheduleFn: (fn: () => void, delayMs: number) => void;
  private readonly cancelScheduleFn: () => void;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;
  private pausedForOverride = false;

  private cabinIds: string[] = [];
  private genIndex = 0;
  private queue: QueuedEphemeral[] = [];
  private qrInterval = 0;
  private emitCount = 0;
  private seqCounter = 0;
  private tape: TrainStep[] = [];

  private state: Omit<TrainPlaybackState, "window"> = {
    isPlaying: true,
    currentCabin: 1,
    dwellSeconds: 15,
    lastTransitionAt: Date.now(),
    cabinCount: 0,
  };

  constructor(deps: TrainPlaybackControllerDeps) {
    this.publish = deps.publish;
    this.now = deps.now ?? (() => Date.now());
    this.scheduleFn = deps.schedule ?? ((fn, delayMs) => {
      this.timerId = setTimeout(fn, delayMs);
    });
    this.cancelScheduleFn = deps.cancelSchedule ?? (() => {
      if (this.timerId !== null) {
        clearTimeout(this.timerId);
        this.timerId = null;
      }
    });
  }

  getState(): TrainPlaybackState {
    return { ...this.state, window: [...this.tape] };
  }

  initialize(dwellSeconds: number, cabinIds: string[]): void {
    this.state.dwellSeconds = clampDwellSeconds(dwellSeconds);
    this.cabinIds = [...cabinIds];
    this.state.cabinCount = this.cabinIds.length;
    if (!this.initialized) {
      this.state.currentCabin = this.clampCabin(this.state.currentCabin);
      this.rebuildTape(this.state.currentCabin - 1);
      this.state.lastTransitionAt = this.now();
      this.initialized = true;
    } else {
      this.reconcileCabinIds();
    }
    this.scheduleNextTick();
  }

  setQrInterval(interval: number): void {
    this.qrInterval = Number.isFinite(interval) && interval > 0 ? Math.floor(interval) : 0;
  }

  /** Enqueue a preview of a just-approved submission (shown ahead of its turn). */
  enqueuePreview(submissionId: string): void {
    if (this.cabinIds.length <= 1) return;
    if (this.queue.some((q) => q.kind === "post" && q.submissionId === submissionId)) return;
    this.queue.push({ kind: "post", submissionId });
  }

  handleUserCommand(command: TrainCommand): void {
    if (command.type === "pause") {
      this.pause();
      return;
    }
    if (command.type === "play") {
      this.play();
      return;
    }
    if (command.type === "jump" && command.cabinNumber !== undefined) {
      this.jump(command.cabinNumber);
    }
  }

  setDwellSeconds(dwellSeconds: number): void {
    this.state.dwellSeconds = clampDwellSeconds(dwellSeconds);
    this.scheduleNextTick();
  }

  setCabinIds(cabinIds: string[]): void {
    this.cabinIds = [...cabinIds];
    this.state.cabinCount = this.cabinIds.length;
    this.reconcileCabinIds();
    this.scheduleNextTick();
  }

  /** Stop dwell timer while blank/placeholder override is active (FR-24c). */
  pauseForOverride(): void {
    this.pausedForOverride = true;
    this.cancelScheduleFn();
  }

  /** Resume dwell scheduling after display override ends. */
  resumeFromOverride(): void {
    this.pausedForOverride = false;
    this.scheduleNextTick();
  }

  private clampCabin(cabin: number): number {
    if (this.cabinIds.length === 0) return 1;
    return Math.max(1, Math.min(cabin, this.cabinIds.length));
  }

  private nextSeq(): number {
    this.seqCounter += 1;
    return this.seqCounter;
  }

  private wrap(idx: number): number {
    const len = this.cabinIds.length;
    if (len === 0) return 0;
    return ((idx % len) + len) % len;
  }

  private postStep(index: number): TrainStep {
    return { seq: this.nextSeq(), kind: "post", submissionId: this.cabinIds[this.wrap(index)] };
  }

  /** Rebuild the window centered on a canonical index (init / jump / reconcile). */
  private rebuildTape(centerIdx: number): void {
    if (this.cabinIds.length === 0) {
      this.tape = [];
      this.genIndex = 0;
      this.state.currentCabin = 1;
      return;
    }
    const tape: TrainStep[] = [];
    for (let off = -LEFT_RENDER; off <= RIGHT_RENDER; off++) {
      tape.push(this.postStep(centerIdx + off));
    }
    this.tape = tape;
    this.genIndex = this.wrap(centerIdx + RIGHT_RENDER);
    this.state.currentCabin = this.wrap(centerIdx) + 1;
  }

  /** Re-center the window when the canonical list changes (approve/delete). */
  private reconcileCabinIds(): void {
    if (this.cabinIds.length === 0) {
      this.tape = [];
      this.genIndex = 0;
      this.state.currentCabin = 1;
      return;
    }
    this.state.currentCabin = this.clampCabin(this.state.currentCabin);
    // Drop ephemerals whose submission no longer exists.
    this.queue = this.queue.filter(
      (q) => q.kind !== "post" || this.cabinIds.includes(q.submissionId),
    );
    // If the window is empty (was 0 cabins) build it; otherwise keep it stable so an
    // approve never causes a visible snap. A delete that orphans a tape post is left
    // for the client to keep showing from its snapshot until it scrolls off.
    if (this.tape.length === 0) {
      this.rebuildTape(this.state.currentCabin - 1);
    } else {
      this.genIndex = this.wrap(this.genIndex);
    }
  }

  private pause(): void {
    this.state.isPlaying = false;
    this.cancelScheduleFn();
    this.publish({ type: "pause" });
  }

  private play(): void {
    this.state.isPlaying = true;
    this.state.lastTransitionAt = this.now();
    this.publish({ type: "play" });
    this.scheduleNextTick();
  }

  private jump(cabinNumber: number): void {
    this.state.currentCabin = this.clampCabin(cabinNumber);
    this.rebuildTape(this.state.currentCabin - 1);
    this.state.lastTransitionAt = this.now();
    this.publish({
      type: "jump",
      cabinNumber: this.state.currentCabin,
      window: [...this.tape],
      currentCabin: this.state.currentCabin,
    });
    this.scheduleNextTick();
  }

  /** One dwell tick: emit the next right-edge cabin and shift the window forward. */
  private advance(): void {
    if (this.cabinIds.length === 0) return;

    this.emitCount += 1;
    if (
      this.qrInterval > 0 && this.emitCount % this.qrInterval === 0 &&
      !this.queue.some((q) => q.kind === "qr")
    ) {
      this.queue.push({ kind: "qr" });
    }

    let step: TrainStep;
    const queued = this.queue.shift();
    if (queued) {
      step = queued.kind === "qr"
        ? { seq: this.nextSeq(), kind: "qr" }
        : { seq: this.nextSeq(), kind: "post", submissionId: queued.submissionId };
    } else {
      this.genIndex = this.wrap(this.genIndex + 1);
      step = this.postStep(this.genIndex);
    }

    this.tape.push(step);
    if (this.tape.length > WINDOW_LENGTH) this.tape.shift();

    const center = this.tape[CENTER_SLOT];
    if (center?.kind === "post" && center.submissionId) {
      const pos = this.cabinIds.indexOf(center.submissionId);
      if (pos >= 0) this.state.currentCabin = pos + 1;
    }

    this.state.lastTransitionAt = this.now();
    this.publish({
      type: "advance",
      cabinNumber: this.state.currentCabin,
      window: [...this.tape],
      currentCabin: this.state.currentCabin,
    });
    this.scheduleNextTick();
  }

  private scheduleNextTick(): void {
    this.cancelScheduleFn();
    if (this.pausedForOverride || !this.state.isPlaying || this.cabinIds.length === 0) return;

    const elapsed = this.now() - this.state.lastTransitionAt;
    const remaining = Math.max(0, this.state.dwellSeconds * 1000 - elapsed);
    this.scheduleFn(() => this.advance(), remaining);
  }
}
