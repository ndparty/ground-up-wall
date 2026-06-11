export interface AppConfig {
  database: { url: string };
  storage: { provider: string; path: string };
  realtime: { provider: string };
}

export function loadConfig(): AppConfig {
  return {
    database: {
      url: Deno.env.get("DATABASE_URL") ?? "postgres://localhost:5432/ground_up_wall_dev",
    },
    storage: {
      provider: "filesystem",
      path: Deno.env.get("STORAGE_PATH") ?? "./uploads",
    },
    realtime: {
      provider: Deno.env.get("REALTIME_PROVIDER") ?? "memory",
    },
  };
}
