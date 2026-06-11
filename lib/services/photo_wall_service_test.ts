import { assertEquals, assertExists } from "@std/assert";
import { join } from "@std/path";
import { FileStorageService } from "../repositories/file_storage_service.ts";
import { MemoryRealtimeService } from "../repositories/memory_realtime_service.ts";
import { AuditServiceImpl } from "./audit_service_impl.ts";
import { AutoModeratorServiceImpl } from "./auto_moderator_service_impl.ts";
import { PhotoWallService } from "./photo_wall_service.ts";
import { cleanupTestData, createTestRepository } from "../test_helpers.ts";
import type { Submission } from "../types.ts";

async function createTestService(storageDir: string): Promise<{
  service: PhotoWallService;
  repo: Awaited<ReturnType<typeof createTestRepository>>;
  realtime: MemoryRealtimeService;
}> {
  const repo = await createTestRepository();
  const storage = new FileStorageService(storageDir);
  const realtime = new MemoryRealtimeService();
  const audit = new AuditServiceImpl(repo);
  const autoModerator = new AutoModeratorServiceImpl();
  const service = new PhotoWallService(repo, storage, realtime, audit, autoModerator);
  return { service, repo, realtime };
}

Deno.test({
  name: "testSubmitSubmissionFlow",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      await cleanupTestData();
      const { service, repo, realtime } = await createTestService(dir);
      let published: Submission | undefined;
      realtime.onSubmissionCreated((s) => {
        published = s;
      });

      const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
      const submission = await service.submitSubmission(
        {
          image: blob,
          message: "Happy National Day",
          submitter_name: "Test User",
        },
        ["crap"],
      );

      assertEquals(submission.status, "pending");
      assertEquals(submission.is_flagged, false);
      assertExists(published);
      assertEquals(published!.id, submission.id);

      const logs = await service.getAuditLog({ action_type: "submit" });
      assertEquals(logs.length, 1);
      await repo.close();
    } finally {
      await cleanupTestData();
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "testApproveFlow",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      await cleanupTestData();
      const { service, repo, realtime } = await createTestService(dir);
      let approved: Submission | undefined;
      realtime.onSubmissionApproved((s) => {
        approved = s;
      });

      const submission = await service.submitSubmission(
        { image: new Blob([new Uint8Array([1])]), message: "Hi", submitter_name: "A" },
        [],
      );
      const result = await service.approveSubmission(submission.id, "mod-1");
      assertEquals(result.status, "approved");
      assertExists(approved);
      assertEquals(approved!.id, submission.id);

      const logs = await service.getAuditLog({ action_type: "approve" });
      assertEquals(logs.length, 1);
      await repo.close();
    } finally {
      await cleanupTestData();
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "testEditFlow",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      await cleanupTestData();
      const { service, repo, realtime } = await createTestService(dir);
      let edited: Submission | undefined;
      realtime.onSubmissionEdited((s) => {
        edited = s;
      });

      const submission = await service.submitSubmission(
        { image: new Blob([new Uint8Array([1])]), message: "Old", submitter_name: "A" },
        [],
      );
      const result = await service.editSubmission(
        submission.id,
        { message: "New" },
        "mod-1",
      );
      assertEquals(result.message, "New");
      assertExists(edited);

      const logs = await service.getAuditLog({ action_type: "edit" });
      assertEquals(logs.length, 1);
      assertExists(logs[0].old_value);
      await repo.close();
    } finally {
      await cleanupTestData();
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "testDeleteFlow",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      await cleanupTestData();
      const { service, repo } = await createTestService(dir);

      const submission = await service.submitSubmission(
        { image: new Blob([new Uint8Array([1, 2, 3])]), message: "Bye", submitter_name: "A" },
        [],
      );

      const imagePath = submission.image_url.replace(/^\//, "");
      await service.deleteSubmission(submission.id, "mod-1");

      const pending = await service.getPendingSubmissions();
      assertEquals(pending.length, 0);

      let fileExists = true;
      try {
        await Deno.stat(join(dir, imagePath));
      } catch {
        fileExists = false;
      }
      assertEquals(fileExists, false);

      const logs = await service.getAuditLog({ action_type: "delete" });
      assertEquals(logs.length, 1);
      await repo.close();
    } finally {
      await cleanupTestData();
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "testCreateModeratorFlow",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      await cleanupTestData();
      const { service, repo } = await createTestService(dir);
      await service.createModerator("newmod", "password123", "admin-1");
      const mods = await service.listModerators();
      assertEquals(mods.length, 1);
      assertEquals(mods[0].username, "newmod");

      const logs = await service.getAuditLog({ action_type: "create_moderator" });
      assertEquals(logs.length, 1);
      await repo.close();
    } finally {
      await cleanupTestData();
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "testUpdateSystemParameterFlow",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      await cleanupTestData();
      const { service, repo, realtime } = await createTestService(dir);
      let configChanged = false;
      realtime.onSystemConfigChanged(() => {
        configChanged = true;
      });

      await service.updateSystemParameter("train_dwell_time", "20", "admin-1");
      const configs = await service.getSystemParameters();
      const dwell = configs.find((c) => c.key === "train_dwell_time");
      assertExists(dwell);
      assertEquals(dwell!.value, "20");
      assertEquals(configChanged, true);

      const logs = await service.getAuditLog({ action_type: "change_config" });
      assertEquals(logs.length, 1);
      await repo.close();
    } finally {
      await cleanupTestData();
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "testSubmitWithFlaggedMessage",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      await cleanupTestData();
      const { service, repo } = await createTestService(dir);
      const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
      const submission = await service.submitPublicSubmission({
        image: blob,
        message: "this is crap content",
        submitter_name: "Flagged User",
      });
      assertEquals(submission.is_flagged, true);
      assertEquals(submission.flagged_words?.includes("crap"), true);
      await repo.close();
    } finally {
      await cleanupTestData();
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "testSubmitWithCleanMessage",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      await cleanupTestData();
      const { service, repo } = await createTestService(dir);
      const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
      const submission = await service.submitPublicSubmission({
        image: blob,
        message: "Happy National Day everyone",
        submitter_name: "Clean User",
      });
      assertEquals(submission.is_flagged, false);
      await repo.close();
    } finally {
      await cleanupTestData();
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "testSubmitWithEmptyWordList",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      await cleanupTestData();
      const { service, repo } = await createTestService(dir);
      await repo.upsertSystemConfig("auto_moderator_word_list", "[]", "system");
      const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
      const submission = await service.submitPublicSubmission({
        image: blob,
        message: "still clean",
        submitter_name: "User",
      });
      assertEquals(submission.is_flagged, false);
      await repo.close();
    } finally {
      await cleanupTestData();
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "testDisplayOverridePersists",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      await cleanupTestData();
      const { service, repo } = await createTestService(dir);
      await service.commandDisplayOverride("blank", "admin-1");
      const state = await service.getDisplayOverrideState();
      assertEquals(state?.type, "blank");
      await repo.close();
    } finally {
      await cleanupTestData();
      await Deno.remove(dir, { recursive: true });
    }
  },
});
