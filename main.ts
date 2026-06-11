import { App, staticFiles } from "fresh";
import { loadConfig } from "./lib/config.ts";
import { createAppState } from "./lib/di.ts";
import { sessionMiddleware } from "./lib/middleware/session.ts";

const appState = createAppState(loadConfig());

export const app = new App<import("./utils.ts").State>()
  .use((ctx) => {
    ctx.state.services = appState;
    return ctx.next();
  })
  .use(sessionMiddleware)
  .use(staticFiles())
  .fsRoutes();
