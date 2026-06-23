import { loadEnvFile } from "./lib/load_env.ts";

loadEnvFile();

const port = Number(Deno.env.get("PORT") ?? "8080");
const hostname = Deno.env.get("HOSTNAME") ?? "127.0.0.1";

const { app } = await import("./main.ts");

console.log(`ground-up-wall listening on http://${hostname}:${port}/`);
await app.listen({ port, hostname });
