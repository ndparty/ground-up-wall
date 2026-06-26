import { assertEquals } from "@std/assert";
import {
  authedRequest,
  createTestHandler,
  loginAsAdmin,
  serveInfo,
} from "../../../../lib/api/concourse_route_test_helpers.ts";
import { cleanupTestData, createTestRepository } from "../../../../lib/test_helpers.ts";

Deno.test({
  name: "testUpdateDwellTimeAuditLogged",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const repo = await createTestRepository();
    await repo.upsertSystemConfig("train_dwell_time", "15", "system");

    const res = await handler(
      authedRequest("http://localhost/api/towkay/parameters/update", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "train_dwell_time", value: "20" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);

    const config = await repo.getSystemConfig("train_dwell_time");
    assertEquals(config?.value, "20");
    const logs = await repo.getAuditLog({ action_type: "change_config" });
    assertEquals(logs.length >= 1, true);
    await repo.close();
    await cleanupTestData();
  },
});

Deno.test({
  name: "testResetWordListToDefault",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const repo = await createTestRepository();
    await repo.upsertSystemConfig("auto_moderator_word_list", '["custom"]', "system");

    await handler(
      authedRequest("http://localhost/api/towkay/parameters/reset", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "auto_moderator_word_list" }),
      }),
      serveInfo,
    );

    const config = await repo.getSystemConfig("auto_moderator_word_list");
    assertEquals(config?.value, config?.default_value);
    await repo.close();
    await cleanupTestData();
  },
});
