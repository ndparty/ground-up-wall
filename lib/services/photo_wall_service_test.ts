import { assertEquals, assertExists } from "@std/assert";
import { join } from "@std/path";
import { FileStorageService } from "../repositories/file_storage_service.ts";
import { MemoryRealtimeService } from "../repositories/memory_realtime_service.ts";
import { AuditServiceImpl } from "./audit_service_impl.ts";
import { AutoModeratorServiceImpl } from "./auto_moderator_service_impl.ts";
import type { DisplayOverrideCommand } from "../interfaces/realtime_service.ts";
import { PhotoWallService } from "./photo_wall_service.ts";
import { cleanupTestData, createTestRepository } from "../test_helpers.ts";
import { testJpegBlob } from "../image/test_jpeg.ts";
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

      const blob = testJpegBlob();
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
        { image: testJpegBlob(), message: "Hi", submitter_name: "A" },
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
        { image: testJpegBlob(), message: "Old", submitter_name: "A" },
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
        { image: testJpegBlob(), message: "Bye", submitter_name: "A" },
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
  name: "testDeleteLastApprovedPublishesEmptyPlayback",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      await cleanupTestData();
      const { service, repo } = await createTestService(dir);

      const submission = await service.submitSubmission(
        { image: testJpegBlob(), message: "Hi", submitter_name: "A" },
        [],
      );
      await service.approveSubmission(submission.id, "mod-1");
      await service.ensurePlaybackInitialized();

      await service.deleteSubmission(submission.id, "mod-1");

      const playback = service.getTrainPlaybackState();
      assertEquals(playback.window.length, 0);
      assertEquals(playback.cabinCount, 0);
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
  name: "testDefaultPlaceholderUploadAndClearAuditAsSetDefaultPlaceholder",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      await cleanupTestData();
      const { service, repo } = await createTestService(dir);

      const image = testJpegBlob();
      await service.uploadDefaultPlaceholder(image, "admin-1");

      let configs = await service.getSystemParameters();
      assertEquals(
        (configs.find((c) => c.key === "default_placeholder_image")?.value ?? "").length > 0,
        true,
      );

      await service.clearDefaultPlaceholder("admin-1");
      configs = await service.getSystemParameters();
      assertEquals(configs.find((c) => c.key === "default_placeholder_image")?.value, "");

      // Both upload and clear audit as set_default_placeholder, not change_config.
      const setLogs = await service.getAuditLog({ action_type: "set_default_placeholder" });
      assertEquals(setLogs.length, 2);
      const changeLogs = await service.getAuditLog({ action_type: "change_config" });
      assertEquals(changeLogs.length, 0);
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
      const blob = testJpegBlob();
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
      const blob = testJpegBlob();
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
      const blob = testJpegBlob();
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
  name: "testEditReflagsMessage",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      await cleanupTestData();
      const { service, repo } = await createTestService(dir);
      await repo.upsertSystemConfig(
        "auto_moderator_word_list",
        JSON.stringify(["crap"]),
        "system",
      );

      const submission = await service.submitSubmission(
        { image: testJpegBlob(), message: "Clean message", submitter_name: "A" },
        ["crap"],
      );
      assertEquals(submission.is_flagged, false);

      const edited = await service.editSubmission(
        submission.id,
        { message: "what crap" },
        "mod-1",
      );
      assertEquals(edited.is_flagged, true);
      assertEquals(edited.flagged_words?.includes("crap"), true);
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

Deno.test({
  name: "testPlaceholderUsesAdminDefault",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      await cleanupTestData();
      const { service, repo, realtime } = await createTestService(dir);
      const blob = testJpegBlob();
      await service.uploadDefaultPlaceholder(blob, "admin-1");

      let command: DisplayOverrideCommand | undefined;
      realtime.onDisplayOverride((cmd) => {
        command = cmd;
      });

      await service.commandDisplayOverride("placeholder", "mod-1");

      const state = await service.getDisplayOverrideState();
      assertEquals(state?.type, "placeholder");
      assertEquals(state?.imageUrl, "/placeholders/default.jpg");
      assertEquals(command?.type, "placeholder");
      assertEquals(command?.imageUrl, "/placeholders/default.jpg");

      const resolved = await service.getResolvedDisplayOverrideState();
      assertEquals(resolved?.imageUrl, "/placeholders/default.jpg");
      await repo.close();
    } finally {
      await cleanupTestData();
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "testReloadDisplayResetsPlaybackWithoutChangingOverride",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      await cleanupTestData();
      const { service, repo, realtime } = await createTestService(dir);
      let reloadCount = 0;
      realtime.subscribe("display:reload", () => {
        reloadCount += 1;
      });

      const submission = await service.submitSubmission(
        { image: testJpegBlob(), message: "Hi", submitter_name: "A" },
        [],
      );
      await service.approveSubmission(submission.id, "mod-1");
      await service.ensurePlaybackInitialized();
      await service.commandDisplayOverride("blank", "mod-1");

      await service.reloadDisplay("mod-1");

      const override = await service.getDisplayOverrideState();
      assertEquals(override?.type, "blank");
      assertEquals(reloadCount, 1);
      const playback = service.getTrainPlaybackState();
      assertEquals(playback.currentCabin, 1);
      const logs = await service.getAuditLog({ action_type: "reload_display" });
      assertEquals(logs.length, 1);
      await repo.close();
    } finally {
      await cleanupTestData();
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "testPanicDisplayBlanksAndResetsPlayback",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      await cleanupTestData();
      const { service, repo, realtime } = await createTestService(dir);
      let reloadCount = 0;
      let overrideCommand: DisplayOverrideCommand | undefined;
      realtime.subscribe("display:reload", () => {
        reloadCount += 1;
      });
      realtime.onDisplayOverride((cmd) => {
        overrideCommand = cmd;
      });

      const submission = await service.submitSubmission(
        { image: testJpegBlob(), message: "Hi", submitter_name: "A" },
        [],
      );
      await service.approveSubmission(submission.id, "mod-1");
      await service.ensurePlaybackInitialized();
      service.getTrainPlaybackState();

      await service.panicDisplay("mod-1");

      const override = await service.getDisplayOverrideState();
      assertEquals(override?.type, "blank");
      assertEquals(overrideCommand?.type, "blank");
      assertEquals(reloadCount, 1);
      const playback = service.getTrainPlaybackState();
      assertEquals(playback.currentCabin, 1);
      assertEquals(playback.isPlaying, true);
      const logs = await service.getAuditLog({ action_type: "panic_display" });
      assertEquals(logs.length, 1);
      await repo.close();
    } finally {
      await cleanupTestData();
      await Deno.remove(dir, { recursive: true });
    }
  },
});
