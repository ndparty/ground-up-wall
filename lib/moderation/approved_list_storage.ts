export const APPROVED_LIST_PAGE_KEY = "semak_approved_page";
export const APPROVED_LIST_PAGE_SIZE_KEY = "semak_approved_page_size";

export const APPROVED_LIST_PAGE_SIZE_OPTIONS = [25, 50, 100, 200, "all"] as const;
export type ApprovedListPageSize = (typeof APPROVED_LIST_PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_APPROVED_LIST_PAGE = 1;
export const DEFAULT_APPROVED_LIST_PAGE_SIZE: ApprovedListPageSize = 25;

export interface ApprovedListPrefs {
  page: number;
  pageSize: ApprovedListPageSize;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  if (typeof globalThis.localStorage === "undefined") return null;
  return globalThis.localStorage;
}

function parsePageSize(raw: string | null): ApprovedListPageSize {
  if (raw === "all") return "all";
  const n = Number.parseInt(raw ?? "", 10);
  if (APPROVED_LIST_PAGE_SIZE_OPTIONS.includes(n as ApprovedListPageSize)) {
    return n as ApprovedListPageSize;
  }
  return DEFAULT_APPROVED_LIST_PAGE_SIZE;
}

function parsePage(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_APPROVED_LIST_PAGE;
  return n;
}

export function loadApprovedListPrefs(
  storage: StorageLike | null = defaultStorage(),
): ApprovedListPrefs {
  if (!storage) {
    return { page: DEFAULT_APPROVED_LIST_PAGE, pageSize: DEFAULT_APPROVED_LIST_PAGE_SIZE };
  }
  return {
    page: parsePage(storage.getItem(APPROVED_LIST_PAGE_KEY)),
    pageSize: parsePageSize(storage.getItem(APPROVED_LIST_PAGE_SIZE_KEY)),
  };
}

export function saveApprovedListPrefs(
  prefs: ApprovedListPrefs,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  storage.setItem(APPROVED_LIST_PAGE_KEY, String(Math.max(1, Math.round(prefs.page))));
  storage.setItem(APPROVED_LIST_PAGE_SIZE_KEY, String(prefs.pageSize));
}
