import { useEffect, useRef, useState } from "preact/hooks";
import type {
  DisplayOverrideCommand,
  TrainCommand,
} from "../lib/interfaces/realtime_service.ts";
import {
  mapCommandToOverrideState,
  resolveOverrideView,
  type OverrideState,
} from "../lib/train/display_override.ts";
import {
  addSubmission,
  cloneChain,
  initTrain,
  jumpToCabin,
  removeSubmission,
  transitionToNext,
  updateSubmission,
  type TrainChain,
} from "../lib/train/chain.ts";
import { clampDwellSeconds, parseDwellTime } from "../lib/train/display_helpers.ts";
import {
  applyApprovedWhilePaused,
  resumeFromPause,
  shouldShowTrainControls,
} from "../lib/train/playback.ts";
import type { Submission } from "../lib/types.ts";
import type { User } from "../lib/types.ts";
import TrainCabin from "./TrainCabin.tsx";
import TrainControls from "./TrainControls.tsx";

const CABIN_STEP_PX = 512; // --cabin-width + --cabin-gap

async function publishTrainCommand(command: TrainCommand): Promise<boolean> {
  const res = await fetch("/api/display/train-command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  return res.ok;
}

function parseSseData<T>(event: MessageEvent): T | null {
  try {
    return JSON.parse(event.data) as T;
  } catch {
    return null;
  }
}

export default function TrainDisplay() {
  const [chain, setChain] = useState<TrainChain>(() => initTrain([]));
  const [dwellTime, setDwellTime] = useState(15);
  const [isPlaying, setIsPlaying] = useState(true);
  const [userRole, setUserRole] = useState<User["role"] | null>(null);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [overrideState, setOverrideState] = useState<OverrideState>({ type: "normal" });
  const isPlayingRef = useRef(isPlaying);
  const initialLoadDone = useRef(false);
  const pendingChainUpdates = useRef<Array<(prev: TrainChain) => TrainChain>>([]);
  isPlayingRef.current = isPlaying;

  const currentIndex = chain.current?.index ?? 0;
  const hasCabins = chain.nodes.length > 0;
  const currentCabin = hasCabins ? currentIndex + 1 : 0;

  function applyChainUpdate(updater: (prev: TrainChain) => TrainChain) {
    if (!initialLoadDone.current) {
      pendingChainUpdates.current.push(updater);
      return;
    }
    setChain(updater);
  }

  function flushPendingChainUpdates(base: TrainChain) {
    let next = base;
    for (const updater of pendingChainUpdates.current) {
      next = updater(next);
    }
    pendingChainUpdates.current = [];
    return next;
  }

  useEffect(() => {
    const dismissed = globalThis.localStorage?.getItem("display_wall_fullscreen_dismissed");
    if (!dismissed) setShowFullscreenPrompt(true);
    document.body.classList.add("display-wall-mode");
    return () => document.body.classList.remove("display-wall-mode");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const [meRes, overrideRes, submissionsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/display/override-state"),
        fetch("/api/display/submissions"),
      ]);

      if (cancelled) return;

      if (meRes.ok) {
        const me = await meRes.json();
        setUserRole(me.user?.role ?? null);
      }

      if (overrideRes.ok) {
        const override = await overrideRes.json();
        setOverrideState(override as OverrideState);
      }

      if (submissionsRes.ok) {
        const data = await submissionsRes.json();
        setDwellTime(clampDwellSeconds(data.dwellTimeSeconds ?? 15));
        const loaded = initTrain(data.submissions as Submission[]);
        initialLoadDone.current = true;
        setChain(flushPendingChainUpdates(loaded));
      } else {
        initialLoadDone.current = true;
        setChain((prev) => flushPendingChainUpdates(prev));
      }
    }

    bootstrap().catch(() => {
      initialLoadDone.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function applyDisplayOverride(command: DisplayOverrideCommand) {
    setOverrideState(mapCommandToOverrideState(command.type, command.imageUrl));
  }

  function applyTrainCommand(command: TrainCommand) {
    if (command.type === "pause") {
      setIsPlaying(false);
      return;
    }
    if (command.type === "play") {
      setIsPlaying(true);
      applyChainUpdate((prev) => {
        const next = cloneChain(prev);
        resumeFromPause(next);
        return { ...next, nodes: [...next.nodes] };
      });
      return;
    }
    if (command.type === "jump" && command.cabinNumber !== undefined) {
      applyChainUpdate((prev) => {
        const next = cloneChain(prev);
        jumpToCabin(next, command.cabinNumber!);
        return { ...next, nodes: [...next.nodes] };
      });
    }
  }

  useEffect(() => {
    const es = new EventSource("/api/display/events");

    es.addEventListener("submission_approved", (event) => {
      const submission = parseSseData<Submission>(event);
      if (!submission) return;
      applyChainUpdate((prev) => {
        const next = cloneChain(prev);
        if (isPlayingRef.current) {
          addSubmission(next, submission);
        } else {
          applyApprovedWhilePaused(next, submission, false);
        }
        return { ...next, nodes: [...next.nodes] };
      });
    });

    es.addEventListener("submission_edited", (event) => {
      const submission = parseSseData<Submission>(event);
      if (!submission) return;
      applyChainUpdate((prev) => {
        const next = cloneChain(prev);
        updateSubmission(next, submission);
        return { ...next, nodes: [...next.nodes] };
      });
    });

    es.addEventListener("submission_deleted", (event) => {
      const payload = parseSseData<{ id: string }>(event);
      if (!payload) return;
      applyChainUpdate((prev) => {
        const next = cloneChain(prev);
        removeSubmission(next, payload.id);
        return { ...next, nodes: [...next.nodes] };
      });
    });

    es.addEventListener("train_command", (event) => {
      const command = parseSseData<TrainCommand>(event);
      if (command) applyTrainCommand(command);
    });

    es.addEventListener("display_override", (event) => {
      const command = parseSseData<DisplayOverrideCommand>(event);
      if (command) applyDisplayOverride(command);
    });

    es.addEventListener("system_config_changed", (event) => {
      const config = parseSseData<{ key: string; value: string }>(event);
      if (config?.key === "train_dwell_time") {
        setDwellTime(clampDwellSeconds(parseDwellTime(config.value)));
      }
    });

    es.onerror = () => {
      es.close();
    };

    return () => es.close();
  }, []);

  useEffect(() => {
    if (!isPlaying || !hasCabins) return;
    const timer = setTimeout(() => {
      applyChainUpdate((prev) => {
        const next = cloneChain(prev);
        transitionToNext(next);
        return { ...next, nodes: [...next.nodes] };
      });
    }, dwellTime * 1000);
    return () => clearTimeout(timer);
  }, [isPlaying, dwellTime, currentIndex, hasCabins]);

  async function pauseTrain() {
    const wasPlaying = isPlaying;
    setIsPlaying(false);
    const ok = await publishTrainCommand({ type: "pause" });
    if (!ok) setIsPlaying(wasPlaying);
  }

  async function resumeTrain() {
    const wasPlaying = isPlaying;
    setIsPlaying(true);
    applyChainUpdate((prev) => {
      const next = cloneChain(prev);
      resumeFromPause(next);
      return { ...next, nodes: [...next.nodes] };
    });
    const ok = await publishTrainCommand({ type: "play" });
    if (!ok) setIsPlaying(wasPlaying);
  }

  async function jumpTrain(cabinNumber: number) {
    const previousIndex = currentIndex;
    applyChainUpdate((prev) => {
      const next = cloneChain(prev);
      jumpToCabin(next, cabinNumber);
      return { ...next, nodes: [...next.nodes] };
    });
    const ok = await publishTrainCommand({ type: "jump", cabinNumber });
    if (!ok) {
      applyChainUpdate((prev) => {
        const next = cloneChain(prev);
        jumpToCabin(next, previousIndex + 1);
        return { ...next, nodes: [...next.nodes] };
      });
    }
  }

  function dismissFullscreenPrompt() {
    globalThis.localStorage?.setItem("display_wall_fullscreen_dismissed", "1");
    setShowFullscreenPrompt(false);
  }

  async function enterFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen requires user gesture; ignore NotAllowedError
    }
    dismissFullscreenPrompt();
  }

  const translateX = -currentIndex * CABIN_STEP_PX;
  const showControls = shouldShowTrainControls(userRole);
  const overrideView = resolveOverrideView(overrideState);

  return (
    <div class="display-wall">
      <link rel="stylesheet" href="/train.css" />

      {showFullscreenPrompt && (
        <div class="display-wall__fullscreen-prompt">
          <button type="button" onClick={enterFullscreen}>
            Click to go fullscreen
          </button>
        </div>
      )}

      {overrideView === "blank" && <div class="display-wall__override-blank" />}

      {overrideView === "placeholder" && (
        <div class="display-wall__override-placeholder">
          {overrideState.imageUrl
            ? <img src={overrideState.imageUrl} alt="Placeholder" />
            : <p>Placeholder</p>}
        </div>
      )}

      {overrideView === "train" && !hasCabins && (
        <div class="display-wall__empty">
          <h2>🇸🇬 Ground Up Wall</h2>
          <p>Submissions coming soon!</p>
        </div>
      )}

      {overrideView === "train" && hasCabins && (
        <div class="display-wall__track-wrap">
          <div
            class="display-wall__track"
            style={{ transform: `translateX(${translateX}px)` }}
          >
            {chain.nodes.map((node) => (
              <TrainCabin
                key={node.submission.id}
                submission={node.submission}
                isActive={node.index === currentIndex}
                index={node.index}
              />
            ))}
          </div>
        </div>
      )}

      {showControls && hasCabins && (
        <TrainControls
          isPlaying={isPlaying}
          onPause={pauseTrain}
          onPlay={resumeTrain}
          onJump={jumpTrain}
          trainLength={chain.nodes.length}
          currentCabin={currentCabin}
        />
      )}
    </div>
  );
}
