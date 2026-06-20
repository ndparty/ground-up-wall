import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { TrainCommand, TrainStep } from "../interfaces/realtime_service.ts";
import type { Submission, User } from "../types.ts";
import {
  addApproved,
  applyServerWindow,
  advanceJumpStep,
  beginJump,
  getCanonicalCount,
  getCurrentCabin,
  initTrainView,
  needsAnimationStep,
  removeSubmissionFromView,
  type TrainViewState,
  updateSubmissionInView,
} from "./train_view.ts";

interface ServerPlaybackState {
  isPlaying: boolean;
  currentCabin: number;
  dwellSeconds?: number;
  lastTransitionAt?: number;
  window?: TrainStep[];
}

interface PendingAdvance {
  window: TrainStep[];
  currentCabin: number;
}

function parseSseData<T>(event: MessageEvent): T | null {
  try {
    return JSON.parse(event.data) as T;
  } catch {
    return null;
  }
}

export interface UseTrainPlaybackResult {
  trainView: TrainViewState;
  isPlaying: boolean;
  userRole: User["role"] | null;
  currentCabin: number;
  trainLength: number;
  pendingAdvances: number;
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
  const pendingRef = useRef<PendingAdvance[]>([]);
  const trainViewRef = useRef(trainView);
  isPlayingRef.current = isPlaying;
  trainViewRef.current = trainView;

  function clearPending(): void {
    pendingRef.current = [];
    setPendingAdvances(0);
  }

  function enqueueAdvance(advance: PendingAdvance): void {
    pendingRef.current = [...pendingRef.current, advance];
    setPendingAdvances(pendingRef.current.length);
  }

  const applyAnimationStep = useCallback(() => {
    setTrainViewState((prev) => (needsAnimationStep(prev) ? advanceJumpStep(prev) : prev));
  }, []);

  const commitAdvance = useCallback(() => {
    const next = pendingRef.current[0];
    pendingRef.current = pendingRef.current.slice(1);
    setPendingAdvances(pendingRef.current.length);
    if (!next) return;
    setTrainViewState((prev) => applyServerWindow(prev, next.window, next.currentCabin));
  }, []);

  const commitJumpTarget = useCallback(() => {
    setTrainViewState((prev) => {
      if (!prev.jump) return prev;
      return {
        ...prev,
        window: prev.jump.pendingWindow,
        currentCabin: prev.jump.pendingCurrentCabin || prev.currentCabin,
        jump: null,
      };
    });
  }, []);

  const syncPlaybackFromServer = useCallback(async () => {
    const res = await fetch("/api/display/submissions");
    if (!res.ok) return;
    const data = await res.json();
    if (data.playback) {
      setIsPlaying(data.playback.isPlaying ?? true);
      clearPending();
      setTrainViewState((prev) => {
        const withCanon = initTrainView(data.submissions as Submission[]);
        const merged: TrainViewState = { ...withCanon, currentCabin: prev.currentCabin };
        return applyServerWindow(
          merged,
          (data.playback.window as TrainStep[]) ?? [],
          data.playback.currentCabin ?? 0,
        );
      });
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
          state = applyServerWindow(
            state,
            (data.playback.window as TrainStep[]) ?? [],
            data.playback.currentCabin ?? 0,
          );
        }
        setTrainViewState(state);
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
      setTrainViewState((prev) => addApproved(prev, submission));
    });

    es.addEventListener("submission_edited", (event) => {
      const submission = parseSseData<Submission>(event);
      if (!submission) return;
      setTrainViewState((prev) => updateSubmissionInView(prev, submission));
    });

    es.addEventListener("submission_deleted", (event) => {
      const payload = parseSseData<{ id: string }>(event);
      if (!payload) return;
      setTrainViewState((prev) => removeSubmissionFromView(prev, payload.id));
    });

    es.addEventListener("train_command", (event) => {
      const command = parseSseData<TrainCommand>(event);
      if (!command) return;

      if (command.type === "pause") {
        setIsPlaying(false);
        clearPending();
        return;
      }
      if (command.type === "play") {
        setIsPlaying(true);
        return;
      }
      if (command.type === "advance" && command.window) {
        if (!isPlayingRef.current) return;
        if (needsAnimationStep(trainViewRef.current)) return;
        enqueueAdvance({ window: command.window, currentCabin: command.currentCabin ?? 0 });
        return;
      }
      if (command.type === "jump" && command.window && command.cabinNumber !== undefined) {
        clearPending();
        setTrainViewState((prev) =>
          beginJump(prev, command.cabinNumber!, command.window!, command.currentCabin ?? 0)
        );
      }
    });

    es.addEventListener("train_playback_state", (event) => {
      const playback = parseSseData<ServerPlaybackState>(event);
      if (!playback) return;
      setIsPlaying(playback.isPlaying);
      clearPending();
      setTrainViewState((prev) => applyServerWindow(prev, playback.window ?? [], playback.currentCabin));
    });

    es.onerror = () => es.close();
    return () => es.close();
  }, [bootstrapComplete]);

  async function pauseTrain(): Promise<boolean> {
    const wasPlaying = isPlaying;
    setIsPlaying(false);
    clearPending();
    const ok = await publishTrainCommand({ type: "pause" });
    if (!ok) setIsPlaying(wasPlaying);
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
    trainLength: getCanonicalCount(trainView),
    pendingAdvances,
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

export type { ServerPlaybackState };
