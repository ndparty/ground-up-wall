import { useState } from "preact/hooks";

export interface TrainControlsProps {
  isPlaying: boolean;
  onPause: () => void;
  onPlay: () => void;
  onJump: (cabinNumber: number) => void;
  trainLength: number;
  currentCabin: number;
}

export default function TrainControls({
  isPlaying,
  onPause,
  onPlay,
  onJump,
  trainLength,
  currentCabin,
}: TrainControlsProps) {
  const [jumpInput, setJumpInput] = useState("");

  function handleJump() {
    const num = Number.parseInt(jumpInput, 10);
    if (!Number.isFinite(num)) return;
    onJump(num);
    setJumpInput("");
  }

  return (
    <div class="train-controls">
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
      <label class="train-controls__jump">
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
  );
}
