import type { PhotoWallService } from "./services/photo_wall_service.ts";

export interface UploadFormConfig {
  messagePromptText: string;
  messageLengthLimit: number;
  messageLengthUnit: "characters" | "words";
}

export const DEFAULT_UPLOAD_CONFIG: UploadFormConfig = {
  messagePromptText: "Share your National Day moment!",
  messageLengthLimit: 50,
  messageLengthUnit: "characters",
};

export async function getUploadFormConfig(
  photoWall: PhotoWallService,
): Promise<UploadFormConfig> {
  const configs = await photoWall.getSystemParameters();
  const byKey = new Map(configs.map((c) => [c.key, c.value]));
  const unit = byKey.get("message_length_unit");
  return {
    messagePromptText: byKey.get("message_prompt_text") ??
      DEFAULT_UPLOAD_CONFIG.messagePromptText,
    messageLengthLimit: Number(
      byKey.get("message_length_limit") ?? DEFAULT_UPLOAD_CONFIG.messageLengthLimit,
    ),
    messageLengthUnit: unit === "words" ? "words" : "characters",
  };
}
