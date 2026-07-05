import { SEEDED_DEFAULT_WORD_LIST } from "../services/auto_moderator_service_impl.ts";

export function validateParameterValue(key: string, value: string): string | null {
  switch (key) {
    case "train_dwell_time": {
      const n = Number.parseInt(value, 10);
      if (!Number.isFinite(n) || n < 3 || n > 60) {
        return "train_dwell_time must be an integer between 3 and 60";
      }
      return null;
    }
    case "message_prompt_text":
      if (value.length > 200) return "message_prompt_text must be at most 200 characters";
      return null;
    case "message_length_limit": {
      const n = Number.parseInt(value, 10);
      if (!Number.isFinite(n) || n < 1 || n > 1000) {
        return "message_length_limit must be between 1 and 1000";
      }
      return null;
    }
    case "message_length_unit":
      if (value !== "characters" && value !== "words") {
        return "message_length_unit must be 'characters' or 'words'";
      }
      return null;
    case "auto_moderator_word_list":
      // Bound the stored list so per-message moderation cannot be made pathological.
      if (value.length > 10_000) return "auto_moderator_word_list is too large";
      return null;
    case "default_placeholder_image": {
      const v = value.trim();
      if (v === "") return null;
      if (v.length > 500) return "default_placeholder_image is too long";
      // Same-origin storage path set by the upload flow, e.g. /placeholders/default.jpg.
      // Reject data:/javascript: and other schemes that could render on the display wall.
      const isSafeStoragePath =
        /^\/(placeholders|overrides)\/[\w.\-/]+\.(jpg|jpeg|png)$/i.test(v) &&
        !v.includes("..");
      if (!isSafeStoragePath) {
        return "default_placeholder_image must be an uploaded placeholder path";
      }
      return null;
    }
    case "pow_challenge_enabled":
      if (value !== "true" && value !== "false") {
        return "pow_challenge_enabled must be 'true' or 'false'";
      }
      return null;
    case "pow_difficulty_bits": {
      const n = Number.parseInt(value, 10);
      if (!Number.isFinite(n) || n < 8 || n > 24) {
        return "pow_difficulty_bits must be an integer between 8 and 24";
      }
      return null;
    }
    case "qr_cabin_interval": {
      const n = Number.parseInt(value, 10);
      if (!Number.isFinite(n) || n < 0 || n > 999) {
        return "qr_cabin_interval must be an integer between 0 and 999 (0 disables)";
      }
      return null;
    }
    case "public_participant_url": {
      if (!value.trim()) return null;
      if (value.length > 200) {
        return "public_participant_url must be at most 200 characters";
      }
      let url: URL;
      try {
        url = new URL(value.trim());
      } catch {
        return "public_participant_url must be a valid http or https URL";
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return "public_participant_url must use http or https";
      }
      if (!url.hostname) {
        return "public_participant_url must include a host";
      }
      const path = url.pathname.replace(/\/$/, "") || "";
      if (path !== "") {
        return "public_participant_url must be a base URL (no path beyond /)";
      }
      return null;
    }
    case "system_killswitch_enabled":
      if (value !== "true" && value !== "false") {
        return "system_killswitch_enabled must be 'true' or 'false'";
      }
      return null;
    case "uploads_enabled":
      if (value !== "true" && value !== "false") {
        return "uploads_enabled must be 'true' or 'false'";
      }
      return null;
    case "display_join_bar_position":
      if (value !== "top" && value !== "bottom") {
        return "display_join_bar_position must be 'top' or 'bottom'";
      }
      return null;
    case "display_corner_qr_enabled":
      if (value !== "true" && value !== "false") {
        return "display_corner_qr_enabled must be 'true' or 'false'";
      }
      return null;
    default:
      return `Unknown parameter key: ${key}`;
  }
}

export function normalizeWordListInput(raw: string): string {
  const words = raw
    .split(/[\n,]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
  return JSON.stringify(words);
}

export function formatWordListForEdit(stored: string): string {
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) return parsed.join(", ");
  } catch {
    // fall through
  }
  return stored;
}

export function seededWordListJson(): string {
  return JSON.stringify([...SEEDED_DEFAULT_WORD_LIST]);
}

/** Append shipped default words missing from an existing list (preserves order and custom entries). */
export function mergeMissingDefaultWords(existing: string[]): string[] {
  const seen = new Set(existing);
  const merged = [...existing];
  for (const word of SEEDED_DEFAULT_WORD_LIST) {
    if (!seen.has(word)) {
      merged.push(word);
      seen.add(word);
    }
  }
  return merged;
}

export const PARAMETER_LABELS: Record<string, string> = {
  train_dwell_time: "Train dwell time (seconds)",
  message_prompt_text: "Upload message prompt",
  message_length_limit: "Message length limit",
  message_length_unit: "Message length unit",
  auto_moderator_word_list: "Auto-moderator word list",
  default_placeholder_image: "Default placeholder image URL",
  pow_challenge_enabled: "Proof-of-work challenge (upload + login)",
  pow_difficulty_bits: "Proof-of-work difficulty (leading zero bits, 8–24)",
  qr_cabin_interval: "QR cabin interval (every N cabins, 0 = off)",
  public_participant_url: "Public participant URL (banner + QR; empty = auto-detect)",
  system_killswitch_enabled: "Event killswitch (disable everything except login + admin)",
  uploads_enabled: "Public uploads enabled",
  display_join_bar_position: "Join bar position (top or bottom of display)",
  display_corner_qr_enabled: "Corner QR codes on the join bar",
};

export const PARAMETER_CATEGORIES: Record<string, string> = {
  train_dwell_time: "Display",
  message_prompt_text: "Upload",
  message_length_limit: "Upload",
  message_length_unit: "Upload",
  auto_moderator_word_list: "Moderation",
  default_placeholder_image: "Display Override",
  pow_challenge_enabled: "Security",
  pow_difficulty_bits: "Security",
  qr_cabin_interval: "Display",
  public_participant_url: "Display",
  system_killswitch_enabled: "Event",
  uploads_enabled: "Event",
  display_join_bar_position: "Display",
  display_corner_qr_enabled: "Display",
};
