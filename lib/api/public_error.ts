const PUBLIC_ERROR_MESSAGES = new Set([
  "Photo is required",
  "Invalid file type",
  "File too large",
  "Name is required",
  "Message exceeds length limit",
  "Privacy notice acknowledgment is required",
  "Image dimensions too large",
  "Passwords do not match",
  "Password change failed",
  "Password must be at least 12 characters",
  "Username and password are required",
  "Invalid role",
  "userId and newPassword are required",
  "User not found",
  "Submission not found",
  "Submission is not pending",
  "Submission cannot be edited",
  "Moderator not found",
  "Display wall user not found",
  "Invalid command type",
  "Invalid override type",
  "cabinNumber required for jump",
  "key is required",
  "Confirmation required",
  "Invalid request",
  "train_dwell_time must be an integer between 3 and 60",
  "message_prompt_text must be at most 200 characters",
  "message_length_limit must be between 1 and 1000",
  "message_length_unit must be 'characters' or 'words'",
  "pow_challenge_enabled must be 'true' or 'false'",
  "pow_difficulty_bits must be an integer between 8 and 24",
  "public_participant_url must be at most 200 characters",
  "public_participant_url must be a valid http or https URL",
  "public_participant_url must use http or https",
  "public_participant_url must include a host",
  "public_participant_url must be a base URL (no path beyond /)",
  "qr_cabin_interval must be an integer between 0 and 999 (0 disables)",
  "system_killswitch_enabled must be 'true' or 'false'",
  "uploads_enabled must be 'true' or 'false'",
]);

/** Return a safe client-facing message; never leak internal error details. */
export function toPublicError(err: unknown, fallback: string): string {
  if (err instanceof Error && PUBLIC_ERROR_MESSAGES.has(err.message)) {
    return err.message;
  }
  if (err instanceof Error && err.message.startsWith("Unknown parameter key:")) {
    return err.message;
  }
  return fallback;
}
