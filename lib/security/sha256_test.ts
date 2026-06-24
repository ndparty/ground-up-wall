import { assertEquals } from "@std/assert";
import { sha256HexSync } from "./sha256.ts";

Deno.test("sha256HexSync matches Web Crypto for sample strings", async () => {
  const samples = ["", "hello", "test-nonce.0", "ground-up-wall"];
  for (const input of samples) {
    const sync = sha256HexSync(input);
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const subtle = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    assertEquals(sync, subtle, input);
  }
});
