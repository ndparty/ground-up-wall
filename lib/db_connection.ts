import { ConnectionError } from "@db/postgres";

const TRANSIENT_MESSAGE_FRAGMENTS = [
  "terminated unexpectedly",
  "Connection refused",
  "connection reset",
  "ECONNRESET",
  "ECONNREFUSED",
  "Connection closed",
  "Broken pipe",
];

export function isTransientDbError(error: unknown): boolean {
  if (error instanceof ConnectionError) return true;
  if (error instanceof Error) {
    const message = error.message;
    return TRANSIENT_MESSAGE_FRAGMENTS.some((fragment) => message.includes(fragment));
  }
  return false;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
