import { Client } from "@db/postgres";
import type { ClientOptions } from "@db/postgres";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function isLocalPostgresHost(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname.toLowerCase());
}

function resolveSslMode(parsed: URL): string | null {
  const fromUrl = parsed.searchParams.get("sslmode");
  if (fromUrl) return fromUrl.toLowerCase();
  const fromEnv = Deno.env.get("PGSSLMODE");
  return fromEnv ? fromEnv.toLowerCase() : null;
}

/** Normalize DATABASE_URL for local @db/postgres connections. */
export function normalizeDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  if (!parsed.username) {
    parsed.username = Deno.env.get("PGUSER") ?? "postgres";
  }
  if (parsed.hostname === "localhost") {
    parsed.hostname = "127.0.0.1";
  }
  const sslmode = resolveSslMode(parsed);
  if (!sslmode && isLocalPostgresHost(parsed.hostname)) {
    parsed.searchParams.set("sslmode", "disable");
  }
  return parsed.toString();
}

export function createPostgresClient(databaseUrl: string): Client {
  return new Client(normalizeDatabaseUrl(databaseUrl));
}

export function postgresClientOptions(databaseUrl: string): ClientOptions {
  const normalized = normalizeDatabaseUrl(databaseUrl);
  const parsed = new URL(normalized);
  const sslmode = resolveSslMode(parsed);
  let tlsEnabled = true;
  if (sslmode === "disable") {
    tlsEnabled = false;
  } else if (
    sslmode === "require" || sslmode === "verify-ca" || sslmode === "verify-full"
  ) {
    tlsEnabled = true;
  } else if (isLocalPostgresHost(parsed.hostname)) {
    tlsEnabled = false;
  }

  return {
    hostname: parsed.hostname,
    port: Number(parsed.port || "5432"),
    user: decodeURIComponent(parsed.username),
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    database: parsed.pathname.replace(/^\//, ""),
    tls: { enabled: tlsEnabled },
  };
}
