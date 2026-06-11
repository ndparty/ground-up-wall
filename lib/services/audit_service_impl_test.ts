import { assertEquals } from "@std/assert";
import { AuditServiceImpl } from "./audit_service_impl.ts";
import { cleanupTestData, createTestRepository } from "../test_helpers.ts";

Deno.test({
  name: "testLogAction",
  async fn() {
    const repo = await createTestRepository();
    const audit = new AuditServiceImpl(repo);
    try {
      await cleanupTestData();
      await audit.logAction({
        moderator_id: "mod-1",
        action_type: "approve",
        target_type: "submission",
        target_id: "sub-1",
        new_value: "approved",
      });
      const logs = await audit.getLog({});
      assertEquals(logs.length, 1);
      assertEquals(logs[0].action_type, "approve");
    } finally {
      await cleanupTestData();
      await repo.close();
    }
  },
});

Deno.test({
  name: "testGetLogWithFilters",
  async fn() {
    const repo = await createTestRepository();
    const audit = new AuditServiceImpl(repo);
    try {
      await cleanupTestData();
      await audit.logAction({
        moderator_id: "mod-1",
        action_type: "approve",
        target_type: "submission",
        target_id: "sub-1",
      });
      await audit.logAction({
        moderator_id: "mod-2",
        action_type: "reject",
        target_type: "submission",
        target_id: "sub-2",
      });
      const filtered = await audit.getLog({
        moderator_id: "mod-1",
        action_type: "approve",
      });
      assertEquals(filtered.length, 1);
      assertEquals(filtered[0].moderator_id, "mod-1");
    } finally {
      await cleanupTestData();
      await repo.close();
    }
  },
});
