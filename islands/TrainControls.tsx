import { useState } from "preact/hooks";

export interface TrainControlsProps {
  isPlaying: boolean;
  onPause: () => void;
  onPlay: () => void;
  onJump: (cabinNumber: number) => void;
  trainLength: number;
  currentCabin: number;
  variant?: "display" | "moderate";
}

export default function TrainControls({
  isPlaying,
  onPause,
  onPlay,
  onJump,
  trainLength,
  currentCabin,
  variant = "display",
}: TrainControlsProps) {
  const [jumpInput, setJumpInput] = useState("");

  function handleJump() {
    const num = Number.parseInt(jumpInput, 10);
    if (!Number.isFinite(num)) return;
    onJump(num);
    setJumpInput("");
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
            onInput={(e) => setJumpInput((e.target as HTMLInputElement).value)}
          />
        </label>
        <button type="button" class="train-controls__btn" onClick={handleJump}>
          Jump
        </button>
      </div>
    </div>
  );
}
