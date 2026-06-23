import { useEffect, useRef, useState } from "preact/hooks";

const JUMP_INPUT_RESUME_MS = 30_000;

export interface TrainControlsProps {
  isPlaying: boolean;
  onPause: () => void;
  onPlay: () => void;
  onJump: (cabinNumber: number) => void;
  trainLength: number;
  currentCabin: number;
  jumpDisabled?: boolean;
  variant?: "display" | "moderate";
}

export default function TrainControls({
  isPlaying,
  onPause,
  onPlay,
  onJump,
  trainLength,
  currentCabin,
  jumpDisabled = false,
  variant = "display",
}: TrainControlsProps) {
  const [jumpInput, setJumpInput] = useState("");
  const [autoSyncJump, setAutoSyncJump] = useState(true);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pauseAutoSync() {
    setAutoSyncJump(false);
    if (resumeTimerRef.current !== null) {
      clearTimeout(resumeTimerRef.current);
    }
    resumeTimerRef.current = setTimeout(() => {
      setAutoSyncJump(true);
      resumeTimerRef.current = null;
    }, JUMP_INPUT_RESUME_MS);
  }

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current !== null) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (autoSyncJump && currentCabin > 0) {
      setJumpInput(String(currentCabin));
    }
  }, [autoSyncJump, currentCabin]);

  function handleJump() {
    const num = Number.parseInt(jumpInput, 10);
    if (!Number.isFinite(num)) return;
    pauseAutoSync();
    onJump(num);
  }

  const rootClass = variant === "moderate"
    ? "train-controls train-controls--moderate"
    : "train-controls";

  return (
    <div class={rootClass}>
      <span class="train-controls__status">
        Cabin {currentCabin} of {trainLength}
      </span>
      <button
        type="button"
        class="train-controls__btn"
        onClick={isPlaying ? onPause : onPlay}
      >
        {isPlaying ? "Pause" : "Play"}
      </button>
      <div class="train-controls__jump">
        <label class="train-controls__jump-label">
          Jump to cabin #
          <input
            type="number"
            min={1}
            max={trainLength}
            value={jumpInput}
            onFocus={pauseAutoSync}
            onInput={(e) => {
              pauseAutoSync();
              setJumpInput((e.target as HTMLInputElement).value);
            }}
          />
        </label>
        <button
          type="button"
          class="train-controls__btn"
          disabled={jumpDisabled}
          onClick={handleJump}
        >
          Jump
        </button>
      </div>
    </div>
  );
}
