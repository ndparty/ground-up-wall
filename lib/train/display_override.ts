export type OverrideView = "train" | "blank" | "placeholder";

export interface OverrideState {
  type: "normal" | "blank" | "placeholder";
  imageUrl?: string;
}

export function resolveOverrideView(state: OverrideState | null): OverrideView {
  if (!state || state.type === "normal") return "train";
  if (state.type === "blank") return "blank";
  return "placeholder";
}

export function mapCommandToOverrideState(
  type: "blank" | "placeholder" | "resume",
  imageUrl?: string,
): OverrideState {
  if (type === "resume") return { type: "normal" };
  if (type === "blank") return { type: "blank" };
  return { type: "placeholder", imageUrl };
}
