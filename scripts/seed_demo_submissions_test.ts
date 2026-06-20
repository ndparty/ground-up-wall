import { assertEquals } from "@std/assert";
import { Client } from "@db/postgres";
import { cleanupTestData, getTestDatabaseUrl } from "../lib/test_helpers.ts";
import {
  DEFAULT_DEMO_SEED_COUNT,
  DEMO_SEED_SOURCE,
  parseSeedDemoArgs,
  runSeedDemoSubmissions,
} from "./seed_demo_submissions.ts";

Deno.test("parseSeedDemoArgs defaults to 40", () => {
  assertEquals(parseSeedDemoArgs([]), { count: DEFAULT_DEMO_SEED_COUNT, force: false });
});

Deno.test("parseSeedDemoArgs reads count and force", () => {
  assertEquals(parseSeedDemoArgs(["--force", "--count=5"]), { count: 5, force: true });
});

Deno.test({
  name: "testSeedDemoSubmissionsCreatesApprovedRows",
  async fn() {
    await cleanupTestData();
    const storageDir = await Deno.makeTempDir();
    Deno.env.set("STORAGE_PATH", storageDir);

    try {
      const first = await runSeedDemoSubmissions({
        databaseUrl: getTestDatabaseUrl(),
        count: 3,
      });
      assertEquals(first.skipped, false);
      assertEquals(first.created, 3);

      const client = new Client(getTestDatabaseUrl());
      await client.connect();
      try {
        const rows = await client.queryObject<{ count: string; status: string }>(
          `SELECT COUNT(*)::text AS count, status FROM submissions WHERE source = $1 GROUP BY status`,
          [DEMO_SEED_SOURCE],
        );
        assertEquals(rows.rows.length, 1);
        assertEquals(rows.rows[0].count, "3");
        assertEquals(rows.rows[0].status, "approved");
      } finally {
        await client.end();
      }

      const second = await runSeedDemoSubmissions({
        databaseUrl: getTestDatabaseUrl(),
        count: 3,
      });
      assertEquals(second.skipped, true);
      assertEquals(second.created, 0);

      const forced = await runSeedDemoSubmissions({
        databaseUrl: getTestDatabaseUrl(),
        count: 2,
        force: true,
      });
      assertEquals(forced.skipped, false);
      assertEquals(forced.created, 2);
      assertEquals(forced.removed, 3);

      const client2 = new Client(getTestDatabaseUrl());
      await client2.connect();
      try {
        const count = await client2.queryObject<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM submissions WHERE source = $1`,
          [DEMO_SEED_SOURCE],
        );
        assertEquals(count.rows[0].count, "2");
      } finally {
        await client2.end();
      }
    } finally {
      Deno.env.delete("STORAGE_PATH");
      await Deno.remove(storageDir, { recursive: true });
      await cleanupTestData();
    }
  },
});
