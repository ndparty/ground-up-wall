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
  User,
} from "../types.ts";

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

    const submission = await this.repository.createSubmission({
      image_url: imageUrl,
      message: data.message,
      submitter_name: data.submitter_name,
      social_handle: data.social_handle,
      flagged_words: flagResult.flagged_words,
      is_flagged: flagResult.is_flagged,
    });

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

  async editSubmission(
    id: string,
    data: SubmissionEditData,
    moderatorId: string,
  ): Promise<Submission> {
    const existing = (await this.repository.getSubmissionsByStatus("pending"))
      .concat(await this.repository.getSubmissionsByStatus("approved"))
      .find((s) => s.id === id);

    const oldValues = existing
      ? JSON.stringify({
        message: existing.message,
        submitter_name: existing.submitter_name,
        social_handle: existing.social_handle,
      })
      : undefined;

    const updated = await this.repository.updateSubmissionContent(id, data, moderatorId);

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
    const submission = await this.repository.updateSubmissionStatus(id, "approved", moderatorId);

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
    const submission = await this.repository.updateSubmissionStatus(id, "rejected");

    await this.audit.logAction({
      moderator_id: moderatorId,
      action_type: "reject",
      target_type: "submission",
      target_id: id,
      new_value: reason ?? "rejected",
    });

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

  publishNewSubmission(submission: Submission): void {
    this.realtime.publish("submission:created", submission);
  }

  subscribeToApproved(callback: (submission: Submission) => void): UnsubscribeFn {
    return this.realtime.onSubmissionApproved(callback);
  }

  publishTrainCommand(command: TrainCommand): void {
    this.realtime.publish("train:command", command);
  }

  subscribeToTrainCommands(callback: (command: TrainCommand) => void): UnsubscribeFn {
    return this.realtime.onTrainCommand(callback);
  }

  async authenticateUser(username: string, password: string): Promise<User | null> {
    const user = await this.repository.authenticateUser(username);
    if (!user || user.disabled) return null;
    const valid = await bcrypt.verify(password, user.password_hash);
    return valid ? user : null;
  }

  async createUser(
    username: string,
    password: string,
    role: User["role"],
    createdBy?: string,
  ): Promise<User> {
    const passwordHash = await bcrypt.hash(password);
    return await this.repository.createUser({
      username,
      password_hash: passwordHash,
      role,
      created_by: createdBy,
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const users = await this.repository.listModerators();
    const allUsers = users;
    let user: User | undefined;
    for (const mod of allUsers) {
      if (mod.id === userId) {
        user = await this.repository.authenticateUser(mod.username) ?? undefined;
        break;
      }
    }
    if (!user) {
      const dwUsers = await this.repository.listDisplayWallUsers();
      for (const dw of dwUsers) {
        if (dw.id === userId) {
          user = await this.repository.authenticateUser(dw.username) ?? undefined;
          break;
        }
      }
    }
    if (!user) throw new Error("User not found");
    const valid = await bcrypt.verify(currentPassword, user.password_hash);
    if (!valid) throw new Error("Invalid current password");
    const hash = await bcrypt.hash(newPassword);
    await this.repository.updateUserPassword(userId, hash);
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
    await this.repository.resetModeratorPassword(moderatorId, hash);

    await this.audit.logAction({
      moderator_id: adminId,
      action_type: "reset_password",
      target_type: "moderator",
      target_id: moderatorId,
    });
  }

  async disableModerator(moderatorId: string, adminId: string): Promise<void> {
    await this.repository.disableModerator(moderatorId);
    await this.audit.logAction({
      moderator_id: adminId,
      action_type: "disable_moderator",
      target_type: "moderator",
      target_id: moderatorId,
    });
  }

  async enableModerator(moderatorId: string, adminId: string): Promise<void> {
    await this.repository.enableModerator(moderatorId);
    await this.audit.logAction({
      moderator_id: adminId,
      action_type: "enable_moderator",
      target_type: "moderator",
      target_id: moderatorId,
    });
  }

  async deleteModerator(moderatorId: string, adminId: string): Promise<void> {
    await this.repository.deleteModerator(moderatorId);
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
    await this.repository.disableDisplayWallUser(userId);
    await this.audit.logAction({
      moderator_id: adminId,
      action_type: "disable_display_wall_user",
      target_type: "display_wall_user",
      target_id: userId,
    });
  }

  async deleteDisplayWallUser(userId: string, adminId: string): Promise<void> {
    await this.repository.deleteDisplayWallUser(userId);
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

    const command: DisplayOverrideCommand = { type, imageUrl };
    await this.realtime.publish("display_override:command", command);
  }

  async getDisplayOverrideState(): Promise<DisplayOverrideState | null> {
    return await this.repository.getDisplayOverrideState();
  }

  subscribeToDisplayOverride(
    callback: (command: DisplayOverrideCommand) => void,
  ): UnsubscribeFn {
    return this.realtime.onDisplayOverride(callback);
  }

  async uploadDefaultPlaceholder(image: Blob, adminId: string): Promise<void> {
    const path = "placeholders/default.jpg";
    await this.storage.uploadImage(image, path);
    const imageUrl = this.storage.getImageUrl(path);
    await this.updateSystemParameter("default_placeholder_image", imageUrl, adminId);
  }
}
