import * as bcrypt from "bcrypt";
import { Client } from "@db/postgres";
import { normalizeDatabaseUrl } from "../lib/db_url.ts";
import { seededWordListJson } from "../lib/admin/parameter_validation.ts";
import { loadEnvFile } from "../lib/load_env.ts";
import { PostgresRepository } from "../lib/repositories/postgres_repository.ts";
import { runMigrations } from "./migrate.ts";

export const ADMIN_USERNAME = "admin";
export const MODERATOR_USERNAME = "moderator";
export const DISPLAY_USERNAME = "display";
const LOCAL_DEV_FALLBACK_PASSWORD = "admin123";
const LOCAL_DEMO_FALLBACK_PASSWORD = "demo123";

const SYSTEM_DEFAULTS = [
  { key: "train_dwell_time", value: "15", default_value: "15" },
  {
    key: "message_prompt_text",
    value: "What does National Day mean to you?",
    default_value: "What does National Day mean to you?",
  },
  { key: "message_length_limit", value: "50", default_value: "50" },
  { key: "message_length_unit", value: "characters", default_value: "characters" },
  {
    key: "auto_moderator_word_list",
    value: seededWordListJson(),
    default_value: seededWordListJson(),
  },
  { key: "default_placeholder_image", value: "", default_value: "" },
] as const;

export interface SeedResult {
  adminCreated: boolean;
  moderatorCreated: boolean;
  displayCreated: boolean;
  configsSeeded: number;
  passwordSource: "env" | "local_fallback";
}

export function resolveAdminPassword(): { password: string; source: "env" | "local_fallback" } {
  const fromEnv = Deno.env.get("ADMIN_INITIAL_PASSWORD");
  if (fromEnv && fromEnv.length > 0) {
    return { password: fromEnv, source: "env" };
  }
  if (Deno.env.get("DENO_DEPLOYMENT_ID")) {
    throw new Error(
      "ADMIN_INITIAL_PASSWORD must be set before running the seed script in deployed environments.",
    );
  }
  return { password: LOCAL_DEV_FALLBACK_PASSWORD, source: "local_fallback" };
}

export function resolveDemoPassword(envKey: string): string {
  const fromEnv = Deno.env.get(envKey);
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  if (Deno.env.get("DENO_DEPLOYMENT_ID")) {
    throw new Error(`${envKey} must be set before running the seed script in deployed environments.`);
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

  await runMigrations(url);

  const { password, source } = resolveAdminPassword();
  const moderatorPassword = resolveDemoPassword("DEMO_MODERATOR_PASSWORD");
  const displayPassword = resolveDemoPassword("DEMO_DISPLAY_PASSWORD");
  const repo = new PostgresRepository(url);
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
    for (const config of SYSTEM_DEFAULTS) {
      const existing = await repo.getSystemConfig(config.key);
      if (!existing) {
        const client = new Client(url);
        await client.connect();
        try {
          await client.queryArray(
            `INSERT INTO system_config (key, value, default_value, updated_by)
             VALUES ($1, $2, $3, 'seed')`,
            [config.key, config.value, config.default_value],
          );
          configsSeeded++;
        } finally {
          await client.end();
        }
      }
    }

    return {
      adminCreated,
      moderatorCreated,
      displayCreated,
      configsSeeded,
      passwordSource: source,
    };
  } finally {
    await repo.close();
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
  console.log("Seed complete.");
}
