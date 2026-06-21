export interface MessageLengthConfig {
  limit: number;
  unit: "characters" | "words";
}

const DEFAULT_LIMIT = 50;

export function normalizeMessageLengthConfig(
  config: Partial<MessageLengthConfig>,
): MessageLengthConfig {
  const limit = Number(config.limit);
  return {
    limit: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT,
    unit: config.unit === "words" ? "words" : "characters",
  };
}

export function getMessageCount(message: string, unit: MessageLengthConfig["unit"]): number {
  if (unit === "characters") {
    return [...message].length;
  }
  return message.trim() ? message.trim().split(/\s+/).length : 0;
}

export function getRemainingLength(message: string, config: MessageLengthConfig): number {
  return config.limit - getMessageCount(message, config.unit);
}

export function isMessageValid(message: string, config: MessageLengthConfig): boolean {
  return getRemainingLength(message, config) >= 0;
}

export function isAtMessageLimit(message: string, config: MessageLengthConfig): boolean {
  return getRemainingLength(message, config) <= 0;
}

export function clampMessageToLimit(message: string, config: MessageLengthConfig): string {
  if (isMessageValid(message, config)) {
    return message;
  }

  if (config.unit === "characters") {
    return [...message].slice(0, config.limit).join("");
  }

  const leading = message.match(/^\s*/)?.[0] ?? "";
  const rest = message.slice(leading.length);
  if (!rest.trim()) {
    return message;
  }

  const words = rest.trim().split(/\s+/);
  return leading + words.slice(0, config.limit).join(" ");
}
