import { loadEnvFile } from "./lib/load_env.ts";

loadEnvFile();

const port = Number(Deno.env.get("PORT") ?? "8080");
const hostname = Deno.env.get("HOSTNAME") ?? "127.0.0.1";

const serverPath = new URL("./_fresh/server.js", import.meta.url);
try {
  await Deno.stat(serverPath);
} catch {
  console.error(
    "error: missing _fresh/server.js — run `deno task build` before starting production",
  );
  Deno.exit(1);
}

const server = await import("./_fresh/server.js");

console.log(`ground-up-wall listening on http://${hostname}:${port}/`);
Deno.serve({ port, hostname }, server.default.fetch);
