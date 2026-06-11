import { assertEquals } from "@std/assert";
import { Client } from "@db/postgres";
import { runMigrations } from "./migrate.ts";
import { getTestDatabaseUrl } from "../lib/test_helpers.ts";

async function tableExists(client: Client, table: string): Promise<boolean> {
  const result = await client.queryObject<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS exists`,
    [table],
  );
  return result.rows[0].exists;
}

Deno.test({
  name: "testMigrationCreatesTables",
  async fn() {
    const url = getTestDatabaseUrl();
    await runMigrations(url);

    const client = new Client(url);
    await client.connect();
    try {
      assertEquals(await tableExists(client, "submissions"), true);
      assertEquals(await tableExists(client, "users"), true);
      assertEquals(await tableExists(client, "audit_log"), true);
      assertEquals(await tableExists(client, "system_config"), true);
    } finally {
      await client.end();
    }
  },
});

Deno.test({
  name: "testMigrationIdempotent",
  async fn() {
    const url = getTestDatabaseUrl();
    await runMigrations(url);
    await runMigrations(url);
  },
});
