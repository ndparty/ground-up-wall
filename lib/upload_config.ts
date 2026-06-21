import type { PhotoWallService } from "./services/photo_wall_service.ts";
import { DEFAULT_MESSAGE_PROMPT } from "./defaults/app_defaults.ts";
import { normalizeMessageLengthConfig } from "./validation/message_length.ts";

export interface UploadFormConfig {
  messagePromptText: string;
  messageLengthLimit: number;
  messageLengthUnit: "characters" | "words";
}

export const DEFAULT_UPLOAD_CONFIG: UploadFormConfig = {
  messagePromptText: DEFAULT_MESSAGE_PROMPT,
  messageLengthLimit: 50,
  messageLengthUnit: "characters",
};

export async function getUploadFormConfig(
  photoWall: PhotoWallService,
): Promise<UploadFormConfig> {
  const configs = await photoWall.getSystemParameters();
  const byKey = new Map(configs.map((c) => [c.key, c.value]));
  const unit = byKey.get("message_length_unit");
  const normalized = normalizeMessageLengthConfig({
    limit: Number(
      byKey.get("message_length_limit") ?? DEFAULT_UPLOAD_CONFIG.messageLengthLimit,
    ),
    unit: unit === "words" ? "words" : "characters",
  });
  return {
    messagePromptText: byKey.get("message_prompt_text") ??
      DEFAULT_UPLOAD_CONFIG.messagePromptText,
    messageLengthLimit: normalized.limit,
    messageLengthUnit: normalized.unit,
  };
}
