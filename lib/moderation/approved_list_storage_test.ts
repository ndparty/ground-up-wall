import { assertEquals } from "@std/assert";
import {
  DEFAULT_APPROVED_LIST_PAGE,
  DEFAULT_APPROVED_LIST_PAGE_SIZE,
  loadApprovedListPrefs,
  saveApprovedListPrefs,
} from "./approved_list_storage.ts";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

Deno.test("loadApprovedListPrefs returns defaults when storage is empty", () => {
  const prefs = loadApprovedListPrefs(new MemoryStorage());
  assertEquals(prefs.page, DEFAULT_APPROVED_LIST_PAGE);
  assertEquals(prefs.pageSize, DEFAULT_APPROVED_LIST_PAGE_SIZE);
});

Deno.test("saveApprovedListPrefs round-trips page and pageSize", () => {
  const storage = new MemoryStorage();
  saveApprovedListPrefs({ page: 3, pageSize: 50 }, storage);
  assertEquals(loadApprovedListPrefs(storage), { page: 3, pageSize: 50 });
});

Deno.test("loadApprovedListPrefs rejects invalid stored values", () => {
  const storage = new MemoryStorage();
  storage.setItem("semak_approved_page", "0");
  storage.setItem("semak_approved_page_size", "999");
  assertEquals(loadApprovedListPrefs(storage), {
    page: DEFAULT_APPROVED_LIST_PAGE,
    pageSize: DEFAULT_APPROVED_LIST_PAGE_SIZE,
  });
});

Deno.test("loadApprovedListPrefs accepts all page size options", () => {
  for (const pageSize of [25, 50, 100, 200, "all"] as const) {
    const storage = new MemoryStorage();
    saveApprovedListPrefs({ page: 2, pageSize }, storage);
    assertEquals(loadApprovedListPrefs(storage).pageSize, pageSize);
  }
});
