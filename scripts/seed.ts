import * as bcrypt from "bcrypt";
import { Client } from "@db/postgres";
import { normalizeDatabaseUrl } from "../lib/db_url.ts";
import { loadEnvFile } from "../lib/load_env.ts";
import { PostgresRepository } from "../lib/repositories/postgres_repository.ts";
import { MockRepository } from "../lib/repositories/mock_repository.ts";
import { buildSystemDefaults, CONFIG_MIGRATIONS } from "../lib/defaults/app_defaults.ts";
import { isDeployedEnvironment } from "../lib/deployed.ts";
import { runMigrations } from "./migrate.ts";

export const ADMIN_USERNAME = "admin";
export const MODERATOR_USERNAME = "moderator";
export const DISPLAY_USERNAME = "display";
const LOCAL_DEV_FALLBACK_PASSWORD = "admin123";
const LOCAL_DEMO_FALLBACK_PASSWORD = "demo123";

const SYSTEM_DEFAULTS = buildSystemDefaults();

export interface SeedResult {
  adminCreated: boolean;
  moderatorCreated: boolean;
  displayCreated: boolean;
  configsSeeded: number;
  configsUpdated: number;
  passwordSource: "env" | "local_fallback";
}

export function resolveAdminPassword(): { password: string; source: "env" | "local_fallback" } {
  const fromEnv = Deno.env.get("ADMIN_INITIAL_PASSWORD");
  if (fromEnv && fromEnv.length > 0) {
    return { password: fromEnv, source: "env" };
  }
  if (isDeployedEnvironment()) {
    throw new Error(
      "ADMIN_INITIAL_PASSWORD must be set before running the seed script in deployed environments.",
    );
  }
  return { password: LOCAL_DEV_FALLBACK_PASSWORD, source: "local_fallback" };
}

export function resolveDemoPassword(envKey: string): string {
  const fromEnv = Deno.env.get(envKey);
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  if (isDeployedEnvironment()) {
    throw new Error(
      `${envKey} must be set before running the seed script in deployed environments.`,
    );
  }
  return LOCAL_DEMO_FALLBACK_PASSWORD;
}

export async function runSeed(databaseUrl?: string): Promise<SeedResult> {
  loadEnvFile();
  const url = normalizeDatabaseUrl(
    databaseUrl ??
      Deno.env.get("DATABASE_URL") ??
      "postgres://localhost:5432/ground_up_wall_dev",
  );

  const useMock = Deno.env.get("USE_MOCK_DB") === "true";
  
  if (!useMock) {
    await runMigrations(url);
  }

  const { password, source } = resolveAdminPassword();
  const moderatorPassword = resolveDemoPassword("DEMO_MODERATOR_PASSWORD");
  const displayPassword = resolveDemoPassword("DEMO_DISPLAY_PASSWORD");
  
  let repo;
  if (useMock) {
    // Always create a fresh mock repository for seeding to avoid state leakage between tests
    repo = new MockRepository();
    const { setMockRepository } = await import("../lib/repositories/mock_repository.ts");
    setMockRepository(repo);
  } else {
    repo = new PostgresRepository(url);
  }
  await repo.connect();

  let adminCreated = false;
  let moderatorCreated = false;
  let displayCreated = false;
  try {
    const existingAdmin = await repo.authenticateUser(ADMIN_USERNAME);
    if (!existingAdmin) {
      const hash = await bcrypt.hash(password);
      await repo.createUser({
        username: ADMIN_USERNAME,
        password_hash: hash,
        role: "admin",
        created_by: "seed",
      });
      adminCreated = true;
    }

    const existingModerator = await repo.authenticateUser(MODERATOR_USERNAME);
    if (!existingModerator) {
      const hash = await bcrypt.hash(moderatorPassword);
      await repo.createModerator({
        username: MODERATOR_USERNAME,
        password_hash: hash,
        role: "moderator",
        created_by: "seed",
      });
      moderatorCreated = true;
    }

    const existingDisplay = await repo.authenticateUser(DISPLAY_USERNAME);
    if (!existingDisplay) {
      const hash = await bcrypt.hash(displayPassword);
      await repo.createDisplayWallUser({
        username: DISPLAY_USERNAME,
        password_hash: hash,
        role: "display_wall",
        created_by: "seed",
      });
      displayCreated = true;
    }

    let configsSeeded = 0;
    let configsUpdated = 0;
    for (const config of SYSTEM_DEFAULTS) {
      const existing = await repo.getSystemConfig(config.key);
      
      if (!existing) {
        await repo.upsertSystemConfig(config.key, config.value, "seed");
        configsSeeded++;
      } else {
        const migration = CONFIG_MIGRATIONS[config.key];
        const nextValue = migration && existing.value === migration.from
          ? migration.to
          : existing.value;
        if (
          existing.default_value !== config.default_value ||
          nextValue !== existing.value
        ) {
          await repo.upsertSystemConfig(config.key, nextValue, "seed");
          configsUpdated++;
        }
      }
    }

    return {
      adminCreated,
      moderatorCreated,
      displayCreated,
      configsSeeded,
      configsUpdated,
      passwordSource: source,
    };
  } finally {
    // Don't close mock repository - it may be reused by subsequent seed operations
    if (!useMock) {
      await repo.close();
    }
  }
}

if (import.meta.main) {
  const result = await runSeed();
  if (result.adminCreated) {
    const { password, source } = resolveAdminPassword();
    console.log(`✓ Created admin user '${ADMIN_USERNAME}'`);
    if (source === "local_fallback") {
      console.log(`  Local dev password: ${password}`);
      console.log("  Set ADMIN_INITIAL_PASSWORD for non-local environments.");
    } else {
      console.log("  Password taken from ADMIN_INITIAL_PASSWORD.");
    }
  } else {
    console.log(`✓ Admin user '${ADMIN_USERNAME}' already exists`);
  }
  if (result.moderatorCreated) {
    console.log(`✓ Created moderator user '${MODERATOR_USERNAME}'`);
  } else {
    console.log(`✓ Moderator user '${MODERATOR_USERNAME}' already exists`);
  }
  if (result.displayCreated) {
    console.log(`✓ Created display-wall user '${DISPLAY_USERNAME}'`);
  } else {
    console.log(`✓ Display-wall user '${DISPLAY_USERNAME}' already exists`);
  }
  if (result.configsSeeded > 0) {
    console.log(`✓ Seeded ${result.configsSeeded} system config entries`);
  } else {
    console.log("✓ System config defaults already present");
  }
  if (result.configsUpdated > 0) {
    console.log(`✓ Updated ${result.configsUpdated} system config default(s)`);
  }
  console.log("Seed complete.");
}
