import { assertEquals, assertExists } from "@std/assert";
import * as bcrypt from "bcrypt";
import { PostgresRepository } from "./postgres_repository.ts";
import { cleanupTestData, createTestRepository } from "../test_helpers.ts";

Deno.test({
  name: "testCreateAndGetSubmission",
  async fn() {
    const repo = await createTestRepository();
    try {
      await cleanupTestData();
      const created = await repo.createSubmission({
        image_url: "/uploads/test.jpg",
        message: "Hello SG",
        submitter_name: "Alice",
      });
      const pending = await repo.getSubmissionsByStatus("pending");
      assertEquals(pending.length, 1);
      assertEquals(pending[0].id, created.id);
      assertEquals(pending[0].message, "Hello SG");
    } finally {
      await cleanupTestData();
      await repo.close();
    }
  },
});

Deno.test({
  name: "testUpdateSubmissionStatus",
  async fn() {
    const repo = await createTestRepository();
    try {
      await cleanupTestData();
      const created = await repo.createSubmission({
        image_url: "/uploads/test.jpg",
        message: "Test",
        submitter_name: "Bob",
      });
      const approved = await repo.updateSubmissionStatus(created.id, "approved", "mod-1");
      assertEquals(approved.status, "approved");
      assertEquals(approved.approved_by, "mod-1");
      assertExists(approved.approved_at);
    } finally {
      await cleanupTestData();
      await repo.close();
    }
  },
});

Deno.test({
  name: "testUpdateSubmissionContent",
  async fn() {
    const repo = await createTestRepository();
    try {
      await cleanupTestData();
      const created = await repo.createSubmission({
        image_url: "/uploads/test.jpg",
        message: "Original",
        submitter_name: "Carol",
      });
      const edited = await repo.updateSubmissionContent(
        created.id,
        { message: "Updated" },
        "mod-1",
      );
      assertEquals(edited.message, "Updated");
      assertEquals(edited.submitter_name, "Carol");
      assertEquals(edited.edit_count, 1);
      assertEquals(edited.edited_by, "mod-1");
      assertExists(edited.edited_at);
    } finally {
      await cleanupTestData();
      await repo.close();
    }
  },
});

Deno.test({
  name: "testDeleteSubmission",
  async fn() {
    const repo = await createTestRepository();
    try {
      await cleanupTestData();
      const created = await repo.createSubmission({
        image_url: "/uploads/test.jpg",
        message: "Delete me",
        submitter_name: "Dave",
      });
      await repo.deleteSubmission(created.id);
      const pending = await repo.getSubmissionsByStatus("pending");
      assertEquals(pending.length, 0);
    } finally {
      await cleanupTestData();
      await repo.close();
    }
  },
});

Deno.test({
  name: "testAuthenticateUser",
  async fn() {
    const repo = await createTestRepository();
    try {
      await cleanupTestData();
      const hash = await bcrypt.hash("secret");
      await repo.createUser({
        username: "moduser",
        password_hash: hash,
        role: "moderator",
      });
      const user = await repo.authenticateUser("moduser");
      assertExists(user);
      assertEquals(user.username, "moduser");
    } finally {
      await cleanupTestData();
      await repo.close();
    }
  },
});

Deno.test({
  name: "testCreateModerator",
  async fn() {
    const repo = await createTestRepository();
    try {
      await cleanupTestData();
      const hash = await bcrypt.hash("pass");
      const user = await repo.createModerator({
        username: "newmod",
        password_hash: hash,
        role: "moderator",
        created_by: "admin-1",
      });
      assertEquals(user.role, "moderator");
      const mods = await repo.listModerators();
      assertEquals(mods.length, 1);
      assertEquals(mods[0].username, "newmod");
    } finally {
      await cleanupTestData();
      await repo.close();
    }
  },
});

Deno.test({
  name: "testDisableAndEnableModerator",
  async fn() {
    const repo = await createTestRepository();
    try {
      await cleanupTestData();
      const hash = await bcrypt.hash("pass");
      const user = await repo.createModerator({
        username: "modtoggle",
        password_hash: hash,
        role: "moderator",
      });
      await repo.disableModerator(user.id);
      let mods = await repo.listModerators();
      assertEquals(mods[0].disabled, true);
      await repo.enableModerator(user.id);
      mods = await repo.listModerators();
      assertEquals(mods[0].disabled, false);
    } finally {
      await cleanupTestData();
      await repo.close();
    }
  },
});

Deno.test({
  name: "testDeleteModeratorPreservesAudit",
  async fn() {
    const repo = await createTestRepository();
    try {
      await cleanupTestData();
      const hash = await bcrypt.hash("pass");
      const user = await repo.createModerator({
        username: "delmod",
        password_hash: hash,
        role: "moderator",
      });
      await repo.createAuditEntry({
        moderator_id: user.id,
        action_type: "approve",
        target_type: "submission",
        target_id: "sub-1",
      });
      await repo.deleteModerator(user.id);
      const mods = await repo.listModerators();
      assertEquals(mods.length, 0);
      const audit = await repo.getAuditLog({ moderator_id: user.id });
      assertEquals(audit.length, 1);
    } finally {
      await cleanupTestData();
      await repo.close();
    }
  },
});

Deno.test({
  name: "testUpsertSystemConfig",
  async fn() {
    const repo = await createTestRepository();
    try {
      await cleanupTestData();
      const created = await repo.upsertSystemConfig("train_dwell_time", "15", "admin-1");
      assertEquals(created.value, "15");
      const updated = await repo.upsertSystemConfig("train_dwell_time", "20", "admin-1");
      assertEquals(updated.value, "20");
    } finally {
      await cleanupTestData();
      await repo.close();
    }
  },
});

Deno.test({
  name: "testNoUpdateOrDeleteOnAuditLog",
  fn() {
    const forbidden = ["updateAuditEntry", "deleteAuditEntry"];
    const proto = Object.getOwnPropertyNames(PostgresRepository.prototype);
    for (const method of forbidden) {
      assertEquals(proto.includes(method), false);
    }
  },
});

Deno.test({
  name: "testCreateAuditEntry",
  async fn() {
    const repo = await createTestRepository();
    try {
      await cleanupTestData();
      const entry = await repo.createAuditEntry({
        moderator_id: "mod-1",
        action_type: "approve",
        target_type: "submission",
        target_id: "sub-1",
        new_value: "approved",
      });
      assertEquals(entry.moderator_id, "mod-1");
      assertEquals(entry.action_type, "approve");
      const logs = await repo.getAuditLog({ action_type: "approve" });
      assertEquals(logs.length, 1);
    } finally {
      await cleanupTestData();
      await repo.close();
    }
  },
});
