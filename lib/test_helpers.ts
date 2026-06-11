import { runMigrations } from "../scripts/migrate.ts";
import { normalizeDatabaseUrl } from "./db_url.ts";
import { PostgresRepository } from "./repositories/postgres_repository.ts";

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
  const { Client } = await import("@db/postgres");
  const client = new Client(normalizeDatabaseUrl(getTestDatabaseUrl()));
  await client.connect();
  try {
    await client.queryArray("DELETE FROM audit_log");
    await client.queryArray("DELETE FROM submissions");
    await client.queryArray("DELETE FROM users");
    await client.queryArray("DELETE FROM system_config");
  } finally {
    await client.end();
  }
}
