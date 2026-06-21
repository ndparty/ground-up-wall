import type { BuildOptions } from "$fresh/dev";

const config: BuildOptions = {
  root: ".",
  routeDir: "routes",
  islandDir: "islands",
  staticDir: "static",
  serverEntry: "main.ts",
  outDir: "_fresh",
};

export default config;
