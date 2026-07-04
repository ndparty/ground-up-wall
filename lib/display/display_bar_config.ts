/** Join-bar placement + corner QR flags for the display wall (admin params). */

export type JoinBarPosition = "top" | "bottom";

export interface DisplayBarConfig {
  joinBarPosition: JoinBarPosition;
  cornerQrEnabled: boolean;
}

export const DEFAULT_DISPLAY_BAR_CONFIG: DisplayBarConfig = {
  joinBarPosition: "top",
  cornerQrEnabled: false,
};

/** Anything but the explicit "bottom" keeps the shipped top placement. */
export function parseJoinBarPosition(value: string | null | undefined): JoinBarPosition {
  return value === "bottom" ? "bottom" : "top";
}

export function parseCornerQrEnabled(value: string | null | undefined): boolean {
  return value === "true";
}
