import { App, staticFiles } from "fresh";
import { loadConfig } from "./lib/config.ts";
import { createAppState } from "./lib/di.ts";
import { loadEnvFile } from "./lib/load_env.ts";
import { serveStorageMiddleware } from "./lib/middleware/serve_storage.ts";
import { sessionMiddleware } from "./lib/middleware/session.ts";

loadEnvFile();
const config = loadConfig();
const appState = createAppState(config);

export const app = new App<import("./utils.ts").State>()
  .use((ctx) => {
    ctx.state.services = appState;
    return ctx.next();
  })
  .use(sessionMiddleware)
  .use(serveStorageMiddleware(config.storage.path))
  .use(staticFiles())
  .fsRoutes();
