/**
 * Server lifecycle management for browser E2E tests.
 * Starts a lightweight HTTP server wrapping the Fresh app handler.
 */

import { Builder } from "$fresh/dev";
import freshConfig from "../../fresh.config.ts";
import { app } from "../../main.ts";

const SERVER_PORT = 8080 + Math.floor(Math.random() * 1000);
const BASE_URL = `http://localhost:${SERVER_PORT}`;

let server: Deno.HttpServer | null = null;

export function getBaseUrl(): string {
  return BASE_URL;
}

/**
 * Start the Fresh app server and wait until it responds to health checks.
 * Must be called once before any browser tests.
 */
export async function startServer(): Promise<void> {
  // Build the Fresh handler
  const builder = new Builder(freshConfig);
  const applySnapshot = await builder.build({ snapshot: "memory" });
  applySnapshot(app);
  const handler = app.handler();

  // Start a Deno HTTP server wrapping the handler
  server = Deno.serve({ port: SERVER_PORT, onListen: () => {} }, (req, info) => {
    return handler(req, info);
  });

  // Poll for readiness (up to 15s)
  for (let i = 0; i < 30; i++) {
    try {
      const resp = await fetch(`${BASE_URL}/api/health`);
      if (resp.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Server did not start within 15 seconds");
}

/**
 * Stop the server. Must be called after all browser tests complete.
 */
export function stopServer(): void {
  if (server) {
    server.shutdown();
    server = null;
  }
}
