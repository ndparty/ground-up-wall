import type { Middleware } from "fresh";
import type { State } from "../../utils.ts";

export type AccessDecision = "allow" | "offline" | "uploads-closed";

export interface AccessFlags {
  killswitch: boolean;
  uploadsEnabled: boolean;
}

/** Paths that remain available even under the event killswitch (login + admin). */
function isAlwaysAllowed(path: string): boolean {
  return (
    path === "/login" ||
    path === "/logout" ||
    path === "/change-password" ||
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path.startsWith("/api/auth/") ||
    path.startsWith("/api/admin/") ||
    path.startsWith("/api/pow/")
  );
}

function isUploadPath(path: string): boolean {
  return path === "/upload" || path === "/api/submissions";
}

/** Pure access decision for a request path given the current admin toggles. */
export function accessDecision(path: string, flags: AccessFlags): AccessDecision {
  if (isAlwaysAllowed(path)) return "allow";
  if (flags.killswitch) return "offline";
  if (!flags.uploadsEnabled && isUploadPath(path)) return "uploads-closed";
  return "allow";
}

const GATE_CSS_LINK = `<link rel="stylesheet" href="/gate.css">`;

export const OFFLINE_HTML =
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Offline</title>${GATE_CSS_LINK}</head><body><div><h1>This event is currently offline</h1><p>Please check back later.</p></div></body></html>`;

export const UPLOADS_CLOSED_HTML =
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Uploads closed</title>${GATE_CSS_LINK}</head><body><div><h1>Uploads are closed</h1><p>Thanks for joining in — photo submissions are no longer being accepted.</p></div></body></html>`;

function blockedResponse(path: string, decision: Exclude<AccessDecision, "allow">): Response {
  const isApi = path.startsWith("/api/");
  const status = 503;
  if (isApi) {
    const error = decision === "offline" ? "Service offline" : "Uploads are closed";
    return new Response(JSON.stringify({ error }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(decision === "offline" ? OFFLINE_HTML : UPLOADS_CLOSED_HTML, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * Gate dynamic routes behind admin-controlled toggles: a full event killswitch
 * (everything except login + admin) and a separate public-uploads switch. Placed
 * after static/storage middleware so assets always load.
 */
export const accessGateMiddleware: Middleware<State> = async (ctx) => {
  const path = new URL(ctx.req.url).pathname;
  if (isAlwaysAllowed(path)) return await ctx.next();

  const photoWall = ctx.state.services.photoWall;
  // Sequential (not Promise.all): the repository uses a single connection that is
  // not safe for concurrent queries. Both reads are cached for 5s so this is cheap.
  const killswitch = await photoWall.isKillswitchEnabled();
  const uploadsEnabled = await photoWall.areUploadsEnabled();

  const decision = accessDecision(path, { killswitch, uploadsEnabled });
  if (decision === "allow") return await ctx.next();
  return blockedResponse(path, decision);
};
