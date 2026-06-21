import { runMigrations } from "../scripts/migrate.ts";
import { normalizeDatabaseUrl } from "./db_url.ts";
import { PostgresRepository } from "./repositories/postgres_repository.ts";

// Disable per-request security gates (rate limit / login lockout / PoW) in the shared
// single-process test run so their in-memory singletons do not accumulate across tests.
// Gate logic itself is covered by rate_limit_test, login_throttle_test, and pow_test.
Deno.env.set("SECURITY_GATES_DISABLED", "1");

const DEFAULT_TEST_DB = "postgres://localhost:5432/ground_up_wall_test";

export function getTestDatabaseUrl(): string {
  return normalizeDatabaseUrl(
    Deno.env.get("DATABASE_URL_TEST") ??
      Deno.env.get("DATABASE_URL") ??
      DEFAULT_TEST_DB,
  );
}

export async function createTestRepository(): Promise<PostgresRepository> {
  const url = getTestDatabaseUrl();
  await runMigrations(url);
  const repo = new PostgresRepository(url);
  await repo.connect();
  return repo;
}

export async function cleanupTestData(): Promise<void> {
  const url = getTestDatabaseUrl();
  await runMigrations(url);
  const { createPostgresClient } = await import("./db_url.ts");
  const client = createPostgresClient(url);
  await client.connect();
  try {
    await client.queryArray("DELETE FROM audit_log");
    await client.queryArray("DELETE FROM sessions");
    await client.queryArray("DELETE FROM submissions");
    await client.queryArray("DELETE FROM users");
    await client.queryArray("DELETE FROM system_config");
  } finally {
    await client.end();
  }
}
