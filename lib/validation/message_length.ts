export interface MessageLengthConfig {
  limit: number;
  unit: "characters" | "words";
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
