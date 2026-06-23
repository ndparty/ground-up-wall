/** True outside local dev — enables HSTS, Secure cookies, and required seed passwords. */
export function isDeployedEnvironment(): boolean {
  if (Deno.env.get("DENO_DEPLOYMENT_ID")) return true;
  const deployed = Deno.env.get("DEPLOYED");
  if (deployed === "1" || deployed?.toLowerCase() === "true") return true;
  return Deno.env.get("NODE_ENV") === "production";
}
