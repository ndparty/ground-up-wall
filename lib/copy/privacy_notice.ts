export const PRIVACY_NOTICE_ITEMS = [
  "Your name, message, and photo will appear on the photowall during the party.",
  "Organisers may keep your submission after the event to share the joy on social media.",
  "If you share your Instagram handle, we might tag you too!",
  "Got questions? Ask any organiser at the party.",
] as const;

export const PRIVACY_NOTICE = PRIVACY_NOTICE_ITEMS.join("\n");
