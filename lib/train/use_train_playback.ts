import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { DisplayOverrideCommand, TrainCommand } from "../interfaces/realtime_service.ts";
import type { Submission } from "../types.ts";
import type { User } from "../types.ts";
import {
  getCurrentCabin,
  initTrainView,
  needsAnimationStep,
  reduceTrainViewEvent,
  type TrainViewState,
} from "./train_view.ts";

interface ServerPlaybackState {
  isPlaying: boolean;
  currentCabin: number;
  dwellSeconds?: number;
  lastTransitionAt?: number;
}

function parseSseData<T>(event: MessageEvent): T | null {
  try {
    return JSON.parse(event.data) as T;
  } catch {
    return null;
  }
}

function applyServerPlayback(
  prev: TrainViewState,
  playback: ServerPlaybackState,
): TrainViewState {
  if (prev.jump || needsAnimationStep(prev)) return prev;
  if (prev.base.nodes.length > 0 && playback.currentCabin) {
    return reduceTrainViewEvent(prev, {
      type: "snap",
      cabinNumber: playback.currentCabin,
    });
  }
  return prev;
}

export interface UseTrainPlaybackResult {
  trainView: TrainViewState;
  isPlaying: boolean;
  userRole: User["role"] | null;
  currentCabin: number;
  trainLength: number;
  pendingAdvances: number;
  setTrainView: (updater: (prev: TrainViewState) => TrainViewState) => void;
  applyAnimationStep: () => void;
  commitAdvance: () => void;
  commitJumpTarget: () => void;
  pauseTrain: () => Promise<boolean>;
  resumeTrain: () => Promise<boolean>;
  jumpTrain: (cabinNumber: number) => Promise<boolean>;
  syncPlaybackFromServer: () => Promise<void>;
  bootstrapComplete: boolean;
}

async function publishTrainCommand(command: TrainCommand): Promise<boolean> {
  const res = await fetch("/api/display/train-command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  return res.ok;
}

export function useTrainPlayback(): UseTrainPlaybackResult {
  const [trainView, setTrainViewState] = useState<TrainViewState>(() => initTrainView([]));
  const [isPlaying, setIsPlaying] = useState(true);
  const [userRole, setUserRole] = useState<User["role"] | null>(null);
  const [bootstrapComplete, setBootstrapComplete] = useState(false);
  const [pendingAdvances, setPendingAdvances] = useState(0);
  const isPlayingRef = useRef(isPlaying);
  const pendingUpdates = useRef<Array<(prev: TrainViewState) => TrainViewState>>([]);
  const pendingAdvancesRef = useRef(0);
  const trainViewRef = useRef(trainView);
  isPlayingRef.current = isPlaying;
  trainViewRef.current = trainView;

  function enqueueAdvance(): void {
    pendingAdvancesRef.current += 1;
    setPendingAdvances(pendingAdvancesRef.current);
  }

  function clearPendingAdvances(): void {
    pendingAdvancesRef.current = 0;
    setPendingAdvances(0);
  }

  const setTrainView = useCallback((updater: (prev: TrainViewState) => TrainViewState) => {
    if (!bootstrapComplete) {
      pendingUpdates.current.push(updater);
      return;
    }
    setTrainViewState(updater);
  }, [bootstrapComplete]);

  function flushPending(base: TrainViewState): TrainViewState {
    let next = base;
    for (const updater of pendingUpdates.current) {
      next = updater(next);
    }
    pendingUpdates.current = [];
    return next;
  }

  const applyAnimationStep = useCallback(() => {
    setTrainViewState((prev) => {
      if (!needsAnimationStep(prev)) return prev;
      return reduceTrainViewEvent(prev, { type: "animation_step" });
    });
  }, []);

  const commitAdvance = useCallback(() => {
    setTrainViewState((prev) => {
      if (prev.jump) return prev;
      return reduceTrainViewEvent(prev, { type: "advance" });
    });
    pendingAdvancesRef.current = Math.max(0, pendingAdvancesRef.current - 1);
    setPendingAdvances(pendingAdvancesRef.current);
  }, []);

  const commitJumpTarget = useCallback(() => {
    setTrainViewState((prev) => {
      if (!prev.jump) return prev;
      return reduceTrainViewEvent(prev, {
        type: "snap",
        cabinNumber: prev.jump.targetCabin,
      });
    });
  }, []);

  const syncPlaybackFromServer = useCallback(async () => {
    const res = await fetch("/api/display/submissions");
    if (!res.ok) return;
    const data = await res.json();
    if (data.playback) {
      setIsPlaying(data.playback.isPlaying ?? true);
      clearPendingAdvances();
      setTrainViewState((prev) => applyServerPlayback(prev, data.playback));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const [meRes, submissionsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/display/submissions"),
      ]);
      if (cancelled) return;

      if (meRes.ok) {
        const me = await meRes.json();
        setUserRole(me.user?.role ?? null);
      }

      if (submissionsRes.ok) {
        const data = await submissionsRes.json();
        let state = initTrainView(data.submissions as Submission[]);
        if (data.playback) {
          setIsPlaying(data.playback.isPlaying ?? true);
          if (state.base.nodes.length > 0 && data.playback.currentCabin) {
            state = reduceTrainViewEvent(state, {
              type: "snap",
              cabinNumber: data.playback.currentCabin,
            });
          }
        }
        setTrainViewState(flushPending(state));
      } else {
        setTrainViewState((prev) => flushPending(prev));
      }
      setBootstrapComplete(true);
    }

    bootstrap().catch(() => setBootstrapComplete(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bootstrapComplete) return;

    const es = new EventSource("/api/display/events");

    es.addEventListener("submission_approved", (event) => {
      const submission = parseSseData<Submission>(event);
      if (!submission) return;
      setTrainViewState((prev) =>
        reduceTrainViewEvent(prev, { type: "approved", submission })
      );
    });

    es.addEventListener("submission_edited", (event) => {
      const submission = parseSseData<Submission>(event);
      if (!submission) return;
      setTrainViewState((prev) => reduceTrainViewEvent(prev, { type: "edited", submission }));
    });

    es.addEventListener("submission_deleted", (event) => {
      const payload = parseSseData<{ id: string }>(event);
      if (!payload) return;
      setTrainViewState((prev) => reduceTrainViewEvent(prev, { type: "deleted", id: payload.id }));
    });

    es.addEventListener("train_command", (event) => {
      const command = parseSseData<TrainCommand>(event);
      if (!command) return;

      if (command.type === "pause") {
        setIsPlaying(false);
        clearPendingAdvances();
        return;
      }
      if (command.type === "play") {
        setIsPlaying(true);
        return;
      }
      if (command.type === "advance" && command.cabinNumber !== undefined) {
        if (!isPlayingRef.current) return;
        const prev = trainViewRef.current;
        if (prev.jump || needsAnimationStep(prev)) return;
        enqueueAdvance();
        return;
      }
      if (command.type === "jump" && command.cabinNumber !== undefined) {
        setTrainViewState((prev) =>
          reduceTrainViewEvent(prev, { type: "jump", cabinNumber: command.cabinNumber! })
        );
      }
    });

    es.addEventListener("train_playback_state", (event) => {
      const playback = parseSseData<ServerPlaybackState>(event);
      if (!playback) return;
      setIsPlaying(playback.isPlaying);
      clearPendingAdvances();
      setTrainViewState((prev) => applyServerPlayback(prev, playback));
    });

    es.addEventListener("display_override", () => {
      // override handled by TrainDisplay
    });

    es.onerror = () => es.close();
    return () => es.close();
  }, [bootstrapComplete]);

  async function pauseTrain(): Promise<boolean> {
    const wasPlaying = isPlaying;
    setIsPlaying(false);
    clearPendingAdvances();
    const ok = await publishTrainCommand({ type: "pause" });
    if (!ok) {
      setIsPlaying(wasPlaying);
    }
    return ok;
  }

  async function resumeTrain(): Promise<boolean> {
    const wasPlaying = isPlaying;
    setIsPlaying(true);
    const ok = await publishTrainCommand({ type: "play" });
    if (!ok) setIsPlaying(wasPlaying);
    return ok;
  }

  async function jumpTrain(cabinNumber: number): Promise<boolean> {
    return publishTrainCommand({ type: "jump", cabinNumber });
  }

  return {
    trainView,
    isPlaying,
    userRole,
    currentCabin: getCurrentCabin(trainView),
    trainLength: trainView.base.nodes.length,
    pendingAdvances,
    setTrainView,
    applyAnimationStep,
    commitAdvance,
    commitJumpTarget,
    pauseTrain,
    resumeTrain,
    jumpTrain,
    syncPlaybackFromServer,
    bootstrapComplete,
  };
}

export type { DisplayOverrideCommand, ServerPlaybackState };
