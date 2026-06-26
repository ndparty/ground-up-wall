import { seededWordListJson } from "../admin/parameter_validation.ts";

/** Default upload form copy when system_config is unset. */
export const DEFAULT_MESSAGE_PROMPT = "Share your National Day moment!";

/** QR cabin copy (not a station destination). */
export const QR_CABIN_DESTINATION = "Join the wall";
export const QR_CABIN_MESSAGE = "Hop on the wall!";
export const QR_CABIN_NAME = "Scan to share your photo";

/** Upload preview roof badge when no server destination is assigned. */
export const UPLOAD_PREVIEW_DESTINATION = "Preview";

/** Public upload rate limit: requests per window. */
export const UPLOAD_RATE_LIMIT = 15;
export const UPLOAD_RATE_WINDOW_MS = 60_000;

/** Login rate limit per IP. */
export const LOGIN_RATE_LIMIT = 10;
export const LOGIN_RATE_WINDOW_MS = 60_000;

/** Max upload request body (bytes) before rejection. */
export const MAX_UPLOAD_REQUEST_BYTES = 12 * 1024 * 1024;

export interface SystemDefaultRow {
  key: string;
  value: string;
  default_value: string;
}

/** Seed defaults for system_config — single source for numeric/text admin parameters. */
export function buildSystemDefaults(): SystemDefaultRow[] {
  const wordList = seededWordListJson();
  return [
    { key: "train_dwell_time", value: "10", default_value: "10" },
    {
      key: "message_prompt_text",
      value: DEFAULT_MESSAGE_PROMPT,
      default_value: DEFAULT_MESSAGE_PROMPT,
    },
    { key: "message_length_limit", value: "50", default_value: "50" },
    { key: "message_length_unit", value: "characters", default_value: "characters" },
    {
      key: "auto_moderator_word_list",
      value: wordList,
      default_value: wordList,
    },
    { key: "default_placeholder_image", value: "", default_value: "" },
    { key: "pow_challenge_enabled", value: "true", default_value: "true" },
    { key: "pow_difficulty_bits", value: "16", default_value: "16" },
    { key: "qr_cabin_interval", value: "15", default_value: "15" },
    { key: "public_participant_url", value: "", default_value: "" },
    { key: "system_killswitch_enabled", value: "false", default_value: "false" },
    { key: "uploads_enabled", value: "true", default_value: "true" },
  ];
}

/** Keys whose live value is upgraded when still at the previous shipped default. */
export const CONFIG_MIGRATIONS: Record<string, { from: string; to: string }> = {
  pow_challenge_enabled: { from: "false", to: "true" },
};
