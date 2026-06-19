import { assertEquals } from "@std/assert";
import { Client } from "@db/postgres";
import {
  ADMIN_USERNAME,
  DISPLAY_USERNAME,
  MODERATOR_USERNAME,
  runSeed,
} from "./seed.ts";
import { cleanupTestData, createTestRepository, getTestDatabaseUrl } from "../lib/test_helpers.ts";

Deno.test({
  name: "testSeedCreatesAdmin",
  async fn() {
    await cleanupTestData();
    const result = await runSeed(getTestDatabaseUrl());
    assertEquals(result.adminCreated, true);

    const repo = await createTestRepository();
    try {
      const admin = await repo.authenticateUser(ADMIN_USERNAME);
      assertEquals(admin?.role, "admin");
      const configs = await repo.getAllSystemConfigs();
      assertEquals(configs.length >= 5, true);
    } finally {
      await repo.close();
      await cleanupTestData();
    }
  },
});

Deno.test({
  name: "testSeedIdempotent",
  async fn() {
    await cleanupTestData();
    await runSeed(getTestDatabaseUrl());
    const second = await runSeed(getTestDatabaseUrl());
    assertEquals(second.adminCreated, false);
    assertEquals(second.configsSeeded, 0);

    const client = new Client(getTestDatabaseUrl());
    await client.connect();
    try {
      const admins = await client.queryObject<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM users WHERE username = $1`,
        [ADMIN_USERNAME],
      );
      assertEquals(admins.rows[0].count, "1");
      const configs = await client.queryObject<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM system_config`,
      );
      assertEquals(Number(configs.rows[0].count) >= 5, true);
    } finally {
      await client.end();
      await cleanupTestData();
    }
  },
});

Deno.test({
  name: "testSeedCreatesDemoAccounts",
  async fn() {
    await cleanupTestData();
    const result = await runSeed(getTestDatabaseUrl());
    assertEquals(result.moderatorCreated, true);
    assertEquals(result.displayCreated, true);

    const repo = await createTestRepository();
    try {
      const moderator = await repo.authenticateUser(MODERATOR_USERNAME);
      assertEquals(moderator?.role, "moderator");
      const display = await repo.authenticateUser(DISPLAY_USERNAME);
      assertEquals(display?.role, "display_wall");
    } finally {
      await repo.close();
      await cleanupTestData();
    }
  },
});

Deno.test({
  name: "testSeedDemoAccountsIdempotent",
  async fn() {
    await cleanupTestData();
    await runSeed(getTestDatabaseUrl());
    const second = await runSeed(getTestDatabaseUrl());
    assertEquals(second.moderatorCreated, false);
    assertEquals(second.displayCreated, false);

    const client = new Client(getTestDatabaseUrl());
    await client.connect();
    try {
      const mods = await client.queryObject<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM users WHERE username = $1`,
        [MODERATOR_USERNAME],
      );
      assertEquals(mods.rows[0].count, "1");
      const displays = await client.queryObject<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM users WHERE username = $1`,
        [DISPLAY_USERNAME],
      );
      assertEquals(displays.rows[0].count, "1");
    } finally {
      await client.end();
      await cleanupTestData();
    }
  },
});
