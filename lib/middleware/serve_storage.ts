import { join, normalize, SEPARATOR as sep } from "@std/path";
import type { Middleware } from "fresh";
import type { AuthState } from "./auth_guard.ts";

const SERVED_PREFIXES = ["submissions/", "placeholders/", "overrides/"];

function contentType(pathname: string): string {
  if (pathname.endsWith(".png")) return "image/png";
  return "image/jpeg";
}

function isPathWithinBase(basePath: string, candidate: string): boolean {
  const base = normalize(basePath);
  const resolved = normalize(candidate);
  return resolved === base || resolved.startsWith(base + sep);
}

/** Serve uploaded images from local storage. Returns null if path is not a storage URL. */
export async function serveStorageFile(
  basePath: string,
  urlPathname: string,
): Promise<Response | null> {
  const relative = urlPathname.startsWith("/") ? urlPathname.slice(1) : urlPathname;
  if (!SERVED_PREFIXES.some((prefix) => relative.startsWith(prefix))) {
    return null;
  }
  if (relative.includes("..")) {
    return new Response("Not Found", { status: 404 });
  }

  const filePath = normalize(join(basePath, relative));
  if (!isPathWithinBase(basePath, filePath)) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    const bytes = await Deno.readFile(filePath);
    return new Response(bytes, {
      headers: {
        "Content-Type": contentType(relative),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return new Response("Not Found", { status: 404 });
    }
    throw err;
  }
}

export function serveStorageMiddleware(basePath: string): Middleware<AuthState> {
  return async (ctx) => {
    const url = new URL(ctx.req.url);
    const response = await serveStorageFile(basePath, url.pathname);
    if (response) return response;
    return ctx.next();
  };
}
