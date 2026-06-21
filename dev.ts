import { Builder } from "$fresh/dev";
import freshConfig from "./fresh.config.ts";

const builder = new Builder(freshConfig);

if (Deno.args.includes("build")) {
  await builder.build();
} else {
  const port = Number(Deno.env.get("PORT") ?? "8080");
  await builder.listen(() => import("./main.ts"), { port });
}
