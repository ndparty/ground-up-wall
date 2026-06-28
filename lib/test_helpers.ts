/// <reference lib="deno.unstable" />
import { runMigrations } from "../scripts/migrate.ts";
import { normalizeDatabaseUrl } from "./db_url.ts";
import type { Repository } from "./interfaces/repository.ts";
import { PostgresRepository } from "./repositories/postgres_repository.ts";
import { MockRepository } from "./repositories/mock_repository.ts";
import { loadEnvFile } from "./load_env.ts";

// Load .env so DATABASE_URL / PGUSER / etc. are available to test helpers.
loadEnvFile();

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

// Point app DI (main.ts loadConfig) at the test database before main is imported.
Deno.env.set("DATABASE_URL", getTestDatabaseUrl());

export async function createTestRepository(): Promise<Repository> {
  const useMock = Deno.env.get("USE_MOCK_DB") === "true";

  if (useMock) {
    const repo = new MockRepository();
    await repo.connect();
    // Store reference for global cleanup
    const { setMockRepository } = await import("./repositories/mock_repository.ts");
    setMockRepository(repo);
    return repo;
  }

  const url = getTestDatabaseUrl();
  await runMigrations(url);
  const repo = new PostgresRepository(url);
  await repo.connect();
  return repo;
}

export async function cleanupTestData(): Promise<void> {
  const useMock = Deno.env.get("USE_MOCK_DB") === "true";

  if (useMock) {
    // Clear the mock repository singleton
    const { clearMockRepository } = await import("./repositories/mock_repository.ts");
    clearMockRepository();

    // Clear PhotoWallService caches to prevent stale data between tests
    try {
      const { resetPhotoWallCaches } = await import("../main.ts");
      resetPhotoWallCaches();
    } catch {
      // Ignore errors - this is best effort cleanup
    }
    return;
  }

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
  const { resetTestSessionCache, resetPhotoWallCaches } = await import("../main.ts");
  resetTestSessionCache();
  resetPhotoWallCaches();
}
