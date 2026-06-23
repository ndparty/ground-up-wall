import type { User } from "../types.ts";

export function loginRedirectPath(role: User["role"]): string {
  if (role === "display_wall") return "/display";
  if (role === "moderator" || role === "admin") return "/moderate";
  return "/upload";
}

export function loginPageRedirect(req: Request): Response {
  return Response.redirect(new URL("/login", req.url), 302);
}

export function roleHomeRedirect(req: Request, role: User["role"]): Response {
  return Response.redirect(new URL(loginRedirectPath(role), req.url), 302);
}
