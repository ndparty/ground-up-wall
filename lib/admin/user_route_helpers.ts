import type { User } from "../types.ts";

export function isManagedRole(role: User["role"]): role is "moderator" | "display_wall" {
  return role === "moderator" || role === "display_wall";
}
