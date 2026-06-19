import * as bcrypt from "bcrypt";
import type { AuditService } from "../interfaces/audit_service.ts";
import type { AutoModeratorService } from "../interfaces/auto_moderator_service.ts";
import type {
  DisplayOverrideCommand,
  RealtimeService,
  TrainCommand,
  UnsubscribeFn,
} from "../interfaces/realtime_service.ts";
import type { Repository } from "../interfaces/repository.ts";
import type { StorageService } from "../interfaces/storage_service.ts";
import { SEEDED_DEFAULT_WORD_LIST } from "./auto_moderator_service_impl.ts";
import { isMessageValid, type MessageLengthConfig } from "../validation/message_length.ts";
import type {
  AuditEntry,
  AuditFilter,
  DisplayOverrideState,
  DisplayWallUser,
  Moderator,
  Submission,
  SubmissionEditData,
  SubmissionInput,
  SystemConfig,
} from "../types.ts";

export function parseWordList(value: string | undefined | null): string[] {
  if (!value) return [...SEEDED_DEFAULT_WORD_LIST];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((w) => typeof w === "string")) {
      return parsed.length > 0 ? parsed : [...SEEDED_DEFAULT_WORD_LIST];
    }
  } catch {
    // fall through
  }
  return [...SEEDED_DEFAULT_WORD_LIST];
}

export class PhotoWallService {
  constructor(
    private repository: Repository,
    private storage: StorageService,
    private realtime: RealtimeService,
    private audit: AuditService,
    private autoModerator: AutoModeratorService,
  ) {}

  async submitSubmission(
    data: SubmissionInput,
    wordList: string[],
    submitterId = "anonymous",
  ): Promise<Submission> {
    const imagePath = `submissions/${crypto.randomUUID()}.jpg`;
    await this.storage.uploadImage(data.image, imagePath);
    const imageUrl = this.storage.getImageUrl(imagePath);

    const flagResult = this.autoModerator.checkMessage(data.message, wordList);

    let submission: Submission;
    try {
      submission = await this.repository.createSubmission({
        image_url: imageUrl,
        message: data.message,
        submitter_name: data.submitter_name,
        social_handle: data.social_handle,
        flagged_words: flagResult.flagged_words,
        is_flagged: flagResult.is_flagged,
      });
    } catch (err) {
      await this.storage.deleteImage(imagePath).catch(() => undefined);
      throw err;
    }

    await this.audit.logAction({
      moderator_id: submitterId,
      action_type: "submit",
      target_type: "submission",
      target_id: submission.id,
      new_value: JSON.stringify({ message: data.message, submitter_name: data.submitter_name }),
    });

    await this.realtime.publish("submission:created", submission);
    return submission;
  }

  async submitPublicSubmission(data: SubmissionInput): Promise<Submission> {
    const config = await this.repository.getSystemConfig("auto_moderator_word_list");
    const wordList = parseWordList(config?.value);
    return await this.submitSubmission(data, wordList, "anonymous");
  }

  async editSubmission(
    id: string,
    data: SubmissionEditData,
    moderatorId: string,
  ): Promise<Submission> {
    const existing = await this.repository.getSubmissionById(id);
    if (!existing) throw new Error("Submission not found");
    if (existing.status !== "pending" && existing.status !== "approved") {
      throw new Error("Submission cannot be edited");
    }

    if (data.message !== undefined) {
      const lengthConfig = await this.getMessageLengthConfig();
      if (!isMessageValid(data.message, lengthConfig)) {
        throw new Error("Message exceeds length limit");
      }
    }

    let editFlags: { is_flagged: boolean; flagged_words: string[] } | undefined;
    if (data.message !== undefined) {
      const config = await this.repository.getSystemConfig("auto_moderator_word_list");
      const wordList = parseWordList(config?.value);
      const flagResult = this.autoModerator.checkMessage(data.message, wordList);
      editFlags = {
        is_flagged: flagResult.is_flagged,
        flagged_words: flagResult.flagged_words,
      };
    }

    const oldValues = JSON.stringify({
      message: existing.message,
      submitter_name: existing.submitter_name,
      social_handle: existing.social_handle,
    });

    const updated = await this.repository.updateSubmissionContent(id, data, moderatorId, editFlags);

    await this.audit.logAction({
      moderator_id: moderatorId,
      action_type: "edit",
      target_type: "submission",
      target_id: id,
      old_value: oldValues,
      new_value: JSON.stringify(data),
    });

    await this.realtime.publish("submission:edited", updated);
    return updated;
  }

  async getPendingSubmissions(): Promise<Submission[]> {
    return await this.repository.getSubmissionsByStatus("pending");
  }

  async getApprovedSubmissions(): Promise<Submission[]> {
    return await this.repository.getSubmissionsByStatus("approved");
  }

  async approveSubmission(id: string, moderatorId: string): Promise<Submission> {
    const submission = await this.repository.updateSubmissionStatusIfPending(id, "approved", moderatorId);
    if (!submission) throw new Error("Submission is not pending");

    await this.audit.logAction({
      moderator_id: moderatorId,
      action_type: "approve",
      target_type: "submission",
      target_id: id,
      new_value: "approved",
    });

    await this.realtime.publish("submission:approved", submission);
    return submission;
  }

  async rejectSubmission(
    id: string,
    moderatorId: string,
    reason?: string,
  ): Promise<Submission> {
    const submission = await this.repository.updateSubmissionStatusIfPending(id, "rejected");
    if (!submission) throw new Error("Submission is not pending");

    await this.audit.logAction({
      moderator_id: moderatorId,
      action_type: "reject",
      target_type: "submission",
      target_id: id,
      new_value: reason ?? "rejected",
    });

    await this.realtime.publish("submission:rejected", { id });
    return submission;
  }

  async deleteSubmission(id: string, moderatorId: string): Promise<void> {
    const submissions = await this.repository.getSubmissionsByStatus("pending")
      .then(async (pending) => {
        const approved = await this.repository.getSubmissionsByStatus("approved");
        const rejected = await this.repository.getSubmissionsByStatus("rejected");
        return [...pending, ...approved, ...rejected];
      });
    const submission = submissions.find((s) => s.id === id);

    await this.repository.deleteSubmission(id);

    if (submission?.image_url) {
      const path = submission.image_url.replace(/^\//, "");
      await this.storage.deleteImage(path);
    }

    await this.audit.logAction({
      moderator_id: moderatorId,
      action_type: "delete",
      target_type: "submission",
      target_id: id,
    });

    await this.realtime.publish("submission:deleted", { id });
  }

  subscribeToApproved(callback: (submission: Submission) => void): UnsubscribeFn {
    return this.realtime.onSubmissionApproved(callback);
  }

  subscribeToCreated(callback: (submission: Submission) => void): UnsubscribeFn {
    return this.realtime.onSubmissionCreated(callback);
  }

  subscribeToEdited(callback: (submission: Submission) => void): UnsubscribeFn {
    return this.realtime.onSubmissionEdited(callback);
  }

  subscribeToDeleted(callback: (payload: { id: string }) => void): UnsubscribeFn {
    return this.realtime.subscribe("submission:deleted", (payload) =>
      callback(payload as { id: string }));
  }

  subscribeToRejected(callback: (payload: { id: string }) => void): UnsubscribeFn {
    return this.realtime.onSubmissionRejected(callback);
  }

  publishTrainCommand(command: TrainCommand): void {
    this.realtime.publish("train:command", command);
  }

  subscribeToTrainCommands(callback: (command: TrainCommand) => void): UnsubscribeFn {
    return this.realtime.onTrainCommand(callback);
  }

  async listModerators(): Promise<Moderator[]> {
    return await this.repository.listModerators();
  }

  async createModerator(
    username: string,
    initialPassword: string,
    adminId: string,
  ): Promise<void> {
    const hash = await bcrypt.hash(initialPassword);
    const user = await this.repository.createModerator({
      username,
      password_hash: hash,
      role: "moderator",
      created_by: adminId,
    });

    await this.audit.logAction({
      moderator_id: adminId,
      action_type: "create_moderator",
      target_type: "moderator",
      target_id: user.id,
      new_value: username,
    });
  }

  async resetModeratorPassword(
    moderatorId: string,
    newPassword: string,
    adminId: string,
  ): Promise<void> {
    const hash = await bcrypt.hash(newPassword);
    const updated = await this.repository.resetModeratorPassword(moderatorId, hash);
    if (!updated) throw new Error("Moderator not found");

    await this.audit.logAction({
      moderator_id: adminId,
      action_type: "reset_password",
      target_type: "moderator",
      target_id: moderatorId,
    });
  }

  async disableModerator(moderatorId: string, adminId: string): Promise<void> {
    const updated = await this.repository.disableModerator(moderatorId);
    if (!updated) throw new Error("Moderator not found");
    await this.audit.logAction({
      moderator_id: adminId,
      action_type: "disable_moderator",
      target_type: "moderator",
      target_id: moderatorId,
    });
  }

  async enableModerator(moderatorId: string, adminId: string): Promise<void> {
    const updated = await this.repository.enableModerator(moderatorId);
    if (!updated) throw new Error("Moderator not found");
    await this.audit.logAction({
      moderator_id: adminId,
      action_type: "enable_moderator",
      target_type: "moderator",
      target_id: moderatorId,
    });
  }

  async deleteModerator(moderatorId: string, adminId: string): Promise<void> {
    const deleted = await this.repository.deleteModerator(moderatorId);
    if (!deleted) throw new Error("Moderator not found");
    await this.audit.logAction({
      moderator_id: adminId,
      action_type: "delete_moderator",
      target_type: "moderator",
      target_id: moderatorId,
    });
  }

  async getSystemParameters(): Promise<SystemConfig[]> {
    return await this.repository.getAllSystemConfigs();
  }

  async updateSystemParameter(key: string, value: string, adminId: string): Promise<void> {
    const existing = await this.repository.getSystemConfig(key);
    const config = await this.repository.upsertSystemConfig(key, value, adminId);

    await this.audit.logAction({
      moderator_id: adminId,
      action_type: "change_config",
      target_type: "system_config",
      target_id: key,
      old_value: existing?.value,
      new_value: value,
    });

    await this.realtime.publish("system_config:changed", config);
  }

  async resetSystemParameterToDefault(key: string, adminId: string): Promise<void> {
    const existing = await this.repository.getSystemConfig(key);
    const config = await this.repository.resetSystemConfigToDefault(key);

    await this.audit.logAction({
      moderator_id: adminId,
      action_type: "change_config",
      target_type: "system_config",
      target_id: key,
      old_value: existing?.value,
      new_value: config.value,
    });

    await this.realtime.publish("system_config:changed", config);
  }

  async getAuditLog(filters: AuditFilter): Promise<AuditEntry[]> {
    return await this.audit.getLog(filters);
  }

  async listDisplayWallUsers(): Promise<DisplayWallUser[]> {
    return await this.repository.listDisplayWallUsers();
  }

  async createDisplayWallUser(
    username: string,
    initialPassword: string,
    adminId: string,
  ): Promise<void> {
    const hash = await bcrypt.hash(initialPassword);
    const user = await this.repository.createDisplayWallUser({
      username,
      password_hash: hash,
      role: "display_wall",
      created_by: adminId,
    });

    await this.audit.logAction({
      moderator_id: adminId,
      action_type: "create_display_wall_user",
      target_type: "display_wall_user",
      target_id: user.id,
      new_value: username,
    });
  }

  async disableDisplayWallUser(userId: string, adminId: string): Promise<void> {
    const updated = await this.repository.disableDisplayWallUser(userId);
    if (!updated) throw new Error("Display wall user not found");
    await this.audit.logAction({
      moderator_id: adminId,
      action_type: "disable_display_wall_user",
      target_type: "display_wall_user",
      target_id: userId,
    });
  }

  async enableDisplayWallUser(userId: string, adminId: string): Promise<void> {
    const updated = await this.repository.enableDisplayWallUser(userId);
    if (!updated) throw new Error("Display wall user not found");
    await this.audit.logAction({
      moderator_id: adminId,
      action_type: "enable_display_wall_user",
      target_type: "display_wall_user",
      target_id: userId,
    });
  }

  async resetDisplayWallUserPassword(
    userId: string,
    newPassword: string,
    adminId: string,
  ): Promise<void> {
    const hash = await bcrypt.hash(newPassword);
    const updated = await this.repository.updateUserPassword(userId, hash);
    if (!updated) throw new Error("Display wall user not found");
    await this.audit.logAction({
      moderator_id: adminId,
      action_type: "reset_password",
      target_type: "display_wall_user",
      target_id: userId,
    });
  }

  async deleteDisplayWallUser(userId: string, adminId: string): Promise<void> {
    const deleted = await this.repository.deleteDisplayWallUser(userId);
    if (!deleted) throw new Error("Display wall user not found");
    await this.audit.logAction({
      moderator_id: adminId,
      action_type: "delete_display_wall_user",
      target_type: "display_wall_user",
      target_id: userId,
    });
  }

  async commandDisplayOverride(
    type: "blank" | "placeholder" | "resume",
    userId: string,
    image?: Blob,
  ): Promise<void> {
    let imageUrl: string | undefined;
    if (type === "placeholder" && image) {
      const path = `overrides/${crypto.randomUUID()}.jpg`;
      await this.storage.uploadImage(image, path);
      imageUrl = this.storage.getImageUrl(path);
    }

    const stateType = type === "resume" ? "normal" : type;
    const state: DisplayOverrideState = {
      type: stateType,
      imageUrl,
      commanded_by: userId,
      commanded_at: new Date().toISOString(),
    };

    await this.repository.setDisplayOverrideState(state);

    const actionMap = {
      blank: "blank_display",
      placeholder: "show_placeholder",
      resume: "resume_display",
    } as const;

    await this.audit.logAction({
      moderator_id: userId,
      action_type: actionMap[type],
      target_type: "display_override",
      target_id: "display_override_state",
      new_value: JSON.stringify(state),
    });

    let resolvedImageUrl = imageUrl;
    if (type === "placeholder" && !resolvedImageUrl) {
      const configs = await this.repository.getAllSystemConfigs();
      resolvedImageUrl = configs.find((c) => c.key === "default_placeholder_image")?.value;
    }

    const command: DisplayOverrideCommand = { type, imageUrl: resolvedImageUrl };
    await this.realtime.publish("display_override:command", command);
  }

  private async getMessageLengthConfig(): Promise<MessageLengthConfig> {
    const configs = await this.repository.getAllSystemConfigs();
    const byKey = new Map(configs.map((c) => [c.key, c.value]));
    const unit = byKey.get("message_length_unit");
    return {
      limit: Number(byKey.get("message_length_limit") ?? 50),
      unit: unit === "words" ? "words" : "characters",
    };
  }

  async getDisplayOverrideState(): Promise<DisplayOverrideState | null> {
    return await this.repository.getDisplayOverrideState();
  }

  subscribeToDisplayOverride(
    callback: (command: DisplayOverrideCommand) => void,
  ): UnsubscribeFn {
    return this.realtime.onDisplayOverride(callback);
  }

  subscribeToSystemConfig(callback: (config: SystemConfig) => void): UnsubscribeFn {
    return this.realtime.onSystemConfigChanged(callback);
  }

  async uploadDefaultPlaceholder(image: Blob, adminId: string): Promise<void> {
    const path = "placeholders/default.jpg";
    await this.storage.uploadImage(image, path);
    const imageUrl = this.storage.getImageUrl(path);
    await this.updateSystemParameter("default_placeholder_image", imageUrl, adminId);
  }
}
