/** Log-safe error summary without leaking message contents (PII, paths, SQL). */
export function safeError(err: unknown): string {
  if (err instanceof Error) {
    return err.name || "Error";
  }
  return "UnknownError";
}
