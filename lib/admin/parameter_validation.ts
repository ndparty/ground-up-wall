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
      return null;
    case "default_placeholder_image":
      return null;
    case "pow_challenge_enabled":
      if (value !== "true" && value !== "false") {
        return "pow_challenge_enabled must be 'true' or 'false'";
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

export const PARAMETER_LABELS: Record<string, string> = {
  train_dwell_time: "Train dwell time (seconds)",
  message_prompt_text: "Upload message prompt",
  message_length_limit: "Message length limit",
  message_length_unit: "Message length unit",
  auto_moderator_word_list: "Auto-moderator word list",
  default_placeholder_image: "Default placeholder image URL",
  pow_challenge_enabled: "Proof-of-work challenge (upload + login)",
};

export const PARAMETER_CATEGORIES: Record<string, string> = {
  train_dwell_time: "Display",
  message_prompt_text: "Upload",
  message_length_limit: "Upload",
  message_length_unit: "Upload",
  auto_moderator_word_list: "Moderation",
  default_placeholder_image: "Display Override",
  pow_challenge_enabled: "Security",
};
