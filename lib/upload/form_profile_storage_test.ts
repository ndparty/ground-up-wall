import { assertEquals } from "@std/assert";
import {
  loadFormProfile,
  saveFormProfile,
  SOCIAL_HANDLE_KEY,
  type StorageLike,
  SUBMITTER_NAME_KEY,
} from "./form_profile_storage.ts";

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem(key) {
      return map.get(key) ?? null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

Deno.test("loadFormProfile returns empty when storage is empty", () => {
  assertEquals(loadFormProfile(createMemoryStorage()), {
    submitterName: "",
    socialHandle: "",
  });
});

Deno.test("saveFormProfile persists trimmed values", () => {
  const storage = createMemoryStorage();
  saveFormProfile({ submitterName: "  Alex  ", socialHandle: " @demo " }, storage);
  assertEquals(storage.getItem(SUBMITTER_NAME_KEY), "Alex");
  assertEquals(storage.getItem(SOCIAL_HANDLE_KEY), "@demo");
  assertEquals(loadFormProfile(storage), { submitterName: "Alex", socialHandle: "@demo" });
});

Deno.test("saveFormProfile removes keys when values are empty", () => {
  const storage = createMemoryStorage();
  saveFormProfile({ submitterName: "Alex", socialHandle: "@demo" }, storage);
  saveFormProfile({ submitterName: "", socialHandle: "  " }, storage);
  assertEquals(storage.getItem(SUBMITTER_NAME_KEY), null);
  assertEquals(storage.getItem(SOCIAL_HANDLE_KEY), null);
});
