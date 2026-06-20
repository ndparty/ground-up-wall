import type { User } from "../types.ts";

export function loginRedirectPath(role: User["role"]): string {
  if (role === "display_wall") return "/display";
  if (role === "moderator" || role === "admin") return "/moderate";
  return "/upload";
}
