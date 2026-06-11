import { Builder } from "$fresh/dev";
import freshConfig from "./fresh.config.ts";

const builder = new Builder(freshConfig);

if (Deno.args.includes("build")) {
  await builder.build();
} else {
  await builder.listen(() => import("./main.ts"));
}
