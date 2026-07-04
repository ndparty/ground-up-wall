import { App, staticFiles } from "fresh";
import { loadConfig } from "./lib/config.ts";
import { type AppState, closeAppState, createAppState } from "./lib/di.ts";
import { loadEnvFile } from "./lib/load_env.ts";
import { accessGateMiddleware } from "./lib/middleware/access_gate.ts";
import { csrfOriginMiddleware } from "./lib/middleware/csrf_origin.ts";
import { securityHeadersMiddleware } from "./lib/middleware/security_headers.ts";
import { serveStorageMiddleware } from "./lib/middleware/serve_storage.ts";
import { sessionMiddleware } from "./lib/middleware/session.ts";

loadEnvFile();
const config = loadConfig();

let appState: AppState | null = null;

export async function shutdownApp(): Promise<void> {
  if (!appState) return;
  await closeAppState(appState);
  appState = null;
}

/** Clear in-memory session cache between tests (DB rows cleared separately). */
export function resetTestSessionCache(): void {
  appState?.auth.clearSessionCache();
}

/** Clear PhotoWallService caches between tests to prevent stale data. */
export function resetPhotoWallCaches(): void {
  appState?.photoWall.clearAllCaches();
}

function registerShutdownHandlers(): void {
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    void shutdownApp().finally(() => Deno.exit(0));
  };
  Deno.addSignalListener("SIGINT", shutdown);
  Deno.addSignalListener("SIGTERM", shutdown);
}

appState = await createAppState(config);
registerShutdownHandlers();

export const app = new App<import("./utils.ts").State>()
  .use((ctx) => {
    ctx.state.services = appState!;
    return ctx.next();
  })
  .use(securityHeadersMiddleware)
  .use(sessionMiddleware)
  .use(csrfOriginMiddleware)
  .use(serveStorageMiddleware(config.storage.path))
  .use(staticFiles())
  .use(accessGateMiddleware)
  .fsRoutes();
