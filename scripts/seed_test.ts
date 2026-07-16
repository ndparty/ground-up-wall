import { assertEquals } from "@std/assert";
import { Client } from "@db/postgres";
import {
  ADMIN_USERNAME,
  DISPLAY_USERNAME,
  MODERATOR_USERNAME,
  PWDCHANGE_USERNAME,
  runSeed,
} from "./seed.ts";
import { cleanupTestData, createTestRepository, getTestDatabaseUrl } from "../lib/test_helpers.ts";

const useMock = Deno.env.get("USE_MOCK_DB") === "true";

Deno.test({
  name: "testSeedCreatesAdmin",
  ignore: useMock,
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
  ignore: useMock,
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
  ignore: useMock,
  async fn() {
    await cleanupTestData();
    const result = await runSeed(getTestDatabaseUrl());
    assertEquals(result.moderatorCreated, true);
    assertEquals(result.displayCreated, true);
    assertEquals(result.pwdchangeCreated, true);

    const repo = await createTestRepository();
    try {
      const moderator = await repo.authenticateUser(MODERATOR_USERNAME);
      assertEquals(moderator?.role, "moderator");
      const display = await repo.authenticateUser(DISPLAY_USERNAME);
      assertEquals(display?.role, "display_wall");
      const pwdchange = await repo.authenticateUser(PWDCHANGE_USERNAME);
      assertEquals(pwdchange?.role, "moderator");
    } finally {
      await repo.close();
      await cleanupTestData();
    }
  },
});

Deno.test({
  name: "testSeedDemoAccountsIdempotent",
  ignore: useMock,
  async fn() {
    await cleanupTestData();
    await runSeed(getTestDatabaseUrl());
    const second = await runSeed(getTestDatabaseUrl());
    assertEquals(second.moderatorCreated, false);
    assertEquals(second.displayCreated, false);
    assertEquals(second.pwdchangeCreated, false);

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
      const pwdchanges = await client.queryObject<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM users WHERE username = $1`,
        [PWDCHANGE_USERNAME],
      );
      assertEquals(pwdchanges.rows[0].count, "1");
    } finally {
      await client.end();
      await cleanupTestData();
    }
  },
});

Deno.test({
  name: "testSeedMigratesPowDefaultToTrue",
  ignore: useMock,
  async fn() {
    await cleanupTestData();
    await runSeed(getTestDatabaseUrl());

    const client = new Client(getTestDatabaseUrl());
    await client.connect();
    try {
      await client.queryArray(
        `UPDATE system_config SET value = 'false', default_value = 'false' WHERE key = 'pow_challenge_enabled'`,
      );
    } finally {
      await client.end();
    }

    const second = await runSeed(getTestDatabaseUrl());
    assertEquals(second.configsUpdated >= 1, true);

    const repo = await createTestRepository();
    try {
      const pow = await repo.getSystemConfig("pow_challenge_enabled");
      assertEquals(pow?.value, "true");
      assertEquals(pow?.default_value, "true");
    } finally {
      await repo.close();
      await cleanupTestData();
    }
  },
});

Deno.test({
  name: "testSeedMergesMissingDefaultModerationWords",
  ignore: useMock,
  async fn() {
    await cleanupTestData();
    await runSeed(getTestDatabaseUrl());

    const client = new Client(getTestDatabaseUrl());
    await client.connect();
    try {
      await client.queryArray(
        `UPDATE system_config SET value = $1, default_value = $1 WHERE key = 'auto_moderator_word_list'`,
        ['["damn","customword"]'],
      );
    } finally {
      await client.end();
    }

    const second = await runSeed(getTestDatabaseUrl());
    assertEquals(second.configsUpdated >= 1, true);

    const repo = await createTestRepository();
    try {
      const config = await repo.getSystemConfig("auto_moderator_word_list");
      const words = JSON.parse(config?.value ?? "[]") as string[];
      assertEquals(words.includes("damn"), true);
      assertEquals(words.includes("customword"), true);
      assertEquals(words.includes("hell"), true);
      assertEquals(words.includes("crap"), true);
    } finally {
      await repo.close();
      await cleanupTestData();
    }
  },
});

Deno.test({
  name: "testSeedMigratesTrainDwellAndQrIntervalDefaults",
  ignore: useMock,
  async fn() {
    await cleanupTestData();
    await runSeed(getTestDatabaseUrl());

    const client = new Client(getTestDatabaseUrl());
    await client.connect();
    try {
      await client.queryArray(
        `UPDATE system_config SET value = '10', default_value = '10' WHERE key = 'train_dwell_time'`,
      );
      await client.queryArray(
        `UPDATE system_config SET value = '15', default_value = '15' WHERE key = 'qr_cabin_interval'`,
      );
    } finally {
      await client.end();
    }

    const second = await runSeed(getTestDatabaseUrl());
    assertEquals(second.configsUpdated >= 2, true);

    const repo = await createTestRepository();
    try {
      const dwell = await repo.getSystemConfig("train_dwell_time");
      const qr = await repo.getSystemConfig("qr_cabin_interval");
      assertEquals(dwell?.value, "5");
      assertEquals(dwell?.default_value, "5");
      assertEquals(qr?.value, "10");
      assertEquals(qr?.default_value, "10");
    } finally {
      await repo.close();
      await cleanupTestData();
    }
  },
});
