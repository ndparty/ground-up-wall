import type { PowFailureReason } from "../security/pow_client.ts";

/** User-facing message for a failed proof-of-work fetch/solve. */
export function powErrorMessage(reason: PowFailureReason): string {
  switch (reason) {
    case "rate_limit":
      return "Too many security checks. Please wait a minute and try again.";
    case "fetch_failed":
      return "Could not load security challenge. Check your connection and try again.";
    case "solve_failed":
      return "Could not complete security check. Please refresh the page and try again.";
    case "network":
      return "Could not reach the server. Check your connection and try again.";
    default:
      return "Security check failed. Please try again.";
  }
}
