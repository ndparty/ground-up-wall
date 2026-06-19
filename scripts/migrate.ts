import { Client } from "@db/postgres";
import { normalizeDatabaseUrl } from "../lib/db_url.ts";
import { loadEnvFile } from "../lib/load_env.ts";

const MIGRATIONS = [
  {
    name: "submissions",
    sql: `
      CREATE TABLE IF NOT EXISTS submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        image_url TEXT NOT NULL,
        message TEXT NOT NULL,
        submitter_name TEXT NOT NULL,
        social_handle TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        source TEXT NOT NULL DEFAULT 'manual_upload',
        source_metadata JSONB,
        flagged_words TEXT[],
        is_flagged BOOLEAN NOT NULL DEFAULT false,
        approved_by TEXT,
        approved_at TIMESTAMPTZ,
        edited_by TEXT,
        edited_at TIMESTAMPTZ,
        edit_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  },
  {
    name: "users",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'display_wall')),
        disabled BOOLEAN NOT NULL DEFAULT false,
        disabled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by TEXT
      );
    `,
  },
  {
    name: "audit_log",
    sql: `
      CREATE TABLE IF NOT EXISTS audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        moderator_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  },
  {
    name: "system_config",
    sql: `
      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        default_value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by TEXT
      );
    `,
  },
  {
    name: "idx_submissions_status",
    sql: `CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);`,
  },
  {
    name: "idx_audit_log_timestamp",
    sql: `CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);`,
  },
];

export async function runMigrations(databaseUrl?: string): Promise<void> {
  loadEnvFile();
  const url = normalizeDatabaseUrl(
    databaseUrl ??
      Deno.env.get("DATABASE_URL") ??
      "postgres://localhost:5432/ground_up_wall_dev",
  );

  const client = new Client(url);
  await client.connect();

  try {
    for (const migration of MIGRATIONS) {
      try {
        await client.queryArray(migration.sql);
        console.log(`✓ ${migration.name}`);
      } catch (err) {
        console.error(`✗ ${migration.name}:`, err);
        throw err;
      }
    }
    console.log("Migration complete.");
  } finally {
    await client.end();
  }
}

if (import.meta.main) {
  await runMigrations();
}
