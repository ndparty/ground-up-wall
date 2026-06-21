/** Load `.env` into Deno.env without overriding existing variables. */
export function loadEnvFile(): void {
  try {
    const content = Deno.readTextFileSync(".env");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!Deno.env.get(key)) {
        Deno.env.set(key, value);
      }
    }
  } catch {
    // .env is optional
  }
}
