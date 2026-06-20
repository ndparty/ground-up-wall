import { Client } from "@db/postgres";
import { assertEquals } from "@std/assert";
import { createPostgresClient, isLocalPostgresHost, normalizeDatabaseUrl } from "./db_url.ts";

Deno.test("isLocalPostgresHost recognizes loopback hosts", () => {
  assertEquals(isLocalPostgresHost("localhost"), true);
  assertEquals(isLocalPostgresHost("127.0.0.1"), true);
  assertEquals(isLocalPostgresHost("::1"), true);
  assertEquals(isLocalPostgresHost("db.example.com"), false);
});

Deno.test("normalizeDatabaseUrl adds sslmode=disable for local host", () => {
  const url = normalizeDatabaseUrl("postgres://localhost:5432/ground_up_wall_dev");
  const parsed = new URL(url);
  assertEquals(parsed.hostname, "127.0.0.1");
  assertEquals(parsed.username, "postgres");
  assertEquals(parsed.searchParams.get("sslmode"), "disable");
});

Deno.test("normalizeDatabaseUrl preserves explicit sslmode=require", () => {
  const url = normalizeDatabaseUrl(
    "postgres://localhost:5432/db?sslmode=require",
  );
  assertEquals(new URL(url).searchParams.get("sslmode"), "require");
});

Deno.test("normalizeDatabaseUrl does not add sslmode for remote host", () => {
  const url = normalizeDatabaseUrl("postgres://db.example.com:5432/prod");
  const parsed = new URL(url);
  assertEquals(parsed.hostname, "db.example.com");
  assertEquals(parsed.searchParams.has("sslmode"), false);
});

Deno.test("createPostgresClient returns a client for normalized url", () => {
  const client = createPostgresClient("postgres://127.0.0.1:5432/test");
  assertEquals(client instanceof Client, true);
});
