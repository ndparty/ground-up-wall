import type { User } from "../types.ts";

// Pages
export const PAGE_MASUK = "/masuk";
export const PAGE_TUKAR = "/tukar";
export const PAGE_MUATNAIK = "/muatnaik";
export const PAGE_SEMAK = "/semak";
export const PAGE_PAMER = "/semak/pamer";
export const PAGE_CONCOURSE = "/concourse";
export const PAGE_TOWKAY = "/towkay";

// API — masuk (session)
export const API_MASUK_SESSION = "/api/masuk/session";
export const API_MASUK_ME = "/api/masuk/me";
export const API_MASUK_LOGOUT = "/api/masuk/logout";
export const API_MASUK_TUKAR = "/api/masuk/tukar";
export const API_MASUK_CHALLENGE = "/api/masuk/challenge";

// API — muatnaik
export const API_MUATNAIK_SUBMIT = "/api/muatnaik/submit";
export const API_MUATNAIK_CONFIG = "/api/muatnaik/config";
export const API_MUATNAIK_EVENTS = "/api/muatnaik/events";

// API prefixes
export const API_SEMAK = "/api/semak";
export const API_CONCOURSE = "/api/concourse";
export const API_TOWKAY = "/api/towkay";

export function loginRedirectPath(role: User["role"]): string {
  if (role === "display_wall") return PAGE_CONCOURSE;
  if (role === "moderator" || role === "admin") return PAGE_SEMAK;
  return PAGE_MUATNAIK;
}

export function loginPageRedirect(req: Request): Response {
  return Response.redirect(new URL(PAGE_MASUK, req.url), 302);
}

export function roleHomeRedirect(req: Request, role: User["role"]): Response {
  return Response.redirect(new URL(loginRedirectPath(role), req.url), 302);
}

/** Paths available under the event killswitch (login + admin). */
export function isKillswitchExempt(path: string): boolean {
  return (
    path === PAGE_MASUK ||
    path === PAGE_TUKAR ||
    path === PAGE_TOWKAY ||
    path.startsWith(`${PAGE_TOWKAY}/`) ||
    path.startsWith("/api/masuk/") ||
    path.startsWith(`${API_TOWKAY}/`)
  );
}

/** Public upload surfaces gated by uploads_enabled. */
export function isUploadGatedPath(path: string): boolean {
  return path === PAGE_MUATNAIK || path === API_MUATNAIK_SUBMIT;
}
