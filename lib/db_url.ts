/** Normalize DATABASE_URL for local @db/postgres connections. */
export function normalizeDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  if (!parsed.username) {
    parsed.username = Deno.env.get("PGUSER") ?? "postgres";
  }
  // Prefer IPv4 loopback — Windows PG trust auth is often configured for 127.0.0.1 only.
  if (parsed.hostname === "localhost") {
    parsed.hostname = "127.0.0.1";
  }
  return parsed.toString();
}
