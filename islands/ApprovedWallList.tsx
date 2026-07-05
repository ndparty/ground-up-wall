import { useEffect, useMemo, useState } from "preact/hooks";
import type { Submission } from "../lib/types.ts";
import {
  loadApprovedListPrefs,
  saveApprovedListPrefs,
} from "../lib/moderation/approved_list_storage.ts";
import { SubmissionCard } from "./ModerationQueue.tsx";

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, "all"] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

function pageSizeLabel(option: PageSizeOption): string {
  return option === "all" ? "All" : String(option);
}

function matchesSearch(sub: Submission, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const fields = [
    sub.message,
    sub.submitter_name,
    sub.social_handle ?? "",
    sub.id,
  ];
  return fields.some((f) => f.toLowerCase().includes(q));
}

function cabinNumberFor(sub: Submission, approved: Submission[]): number {
  const idx = approved.findIndex((s) => s.id === sub.id);
  return idx >= 0 ? idx + 1 : 0;
}

export default function ApprovedWallList({
  approved,
  onEdit,
  onDelete,
  onShowOnDisplay,
}: {
  approved: Submission[];
  onEdit: (
    sub: Submission,
    data: { message: string; submitter_name: string; social_handle: string },
  ) => Promise<void>;
  onDelete: (sub: Submission) => Promise<void>;
  onShowOnDisplay: (cabinNumber: number) => Promise<void>;
}) {
  const storedPrefs = loadApprovedListPrefs();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(storedPrefs.page);
  const [pageSize, setPageSize] = useState<PageSizeOption>(storedPrefs.pageSize);

  const filtered = useMemo(
    () => approved.filter((sub) => matchesSearch(sub, search)),
    [approved, search],
  );

  const effectivePageSize = pageSize === "all" ? Math.max(filtered.length, 1) : pageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length / effectivePageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (safePage - 1) * effectivePageSize,
    safePage * effectivePageSize,
  );

  useEffect(() => {
    if (safePage !== page) {
      setPage(safePage);
      saveApprovedListPrefs({ page: safePage, pageSize });
    }
  }, [safePage, page, pageSize]);

  function updatePage(next: number) {
    setPage(next);
    saveApprovedListPrefs({ page: next, pageSize });
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    updatePage(1);
  }

  function handlePageSizeChange(value: PageSizeOption) {
    setPageSize(value);
    setPage(1);
    saveApprovedListPrefs({ page: 1, pageSize: value });
  }

  if (approved.length === 0) {
    return <p class="text-muted">No approved submissions</p>;
  }

  return (
    <div>
      <div class="approved-toolbar">
        <label class="form-stack-label">
          <span class="text-small">Search approved</span>
          <input
            type="search"
            value={search}
            placeholder="Message, name, handle, or id…"
            aria-label="Search approved submissions"
            onInput={(e) => handleSearchChange((e.target as HTMLInputElement).value)}
            class="form-input--bordered"
          />
        </label>
        <label class="form-stack-label form-stack-label--compact">
          <span class="text-small">Per page</span>
          <select
            value={pageSize}
            aria-label="Entries per page"
            onChange={(e) => {
              const raw = (e.target as HTMLSelectElement).value;
              handlePageSizeChange(
                raw === "all" ? "all" : Number(raw) as PageSizeOption,
              );
            }}
            class="form-input--bordered"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {pageSizeLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <p class="approved-toolbar__count">
          {filtered.length} result{filtered.length === 1 ? "" : "s"}
          {search.trim() ? ` (of ${approved.length})` : ""}
        </p>
      </div>

      {pageItems.length === 0 ? <p class="text-muted">No matches</p> : pageItems.map((sub) => {
        const cabin = cabinNumberFor(sub, approved);
        return (
          <SubmissionCard
            key={sub.id}
            submission={sub}
            showDelete
            cabinNumber={cabin}
            lazyImage
            onEdit={(data) => onEdit(sub, data)}
            onDelete={() => onDelete(sub)}
            onShowOnDisplay={() => onShowOnDisplay(cabin)}
          />
        );
      })}

      {pageSize !== "all" && totalPages > 1 && (
        <div class="pagination-bar--list">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => updatePage(Math.max(1, safePage - 1))}
            class="btn btn--ghost"
          >
            Previous
          </button>
          <span class="text-xs">
            Page {safePage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => updatePage(Math.min(totalPages, safePage + 1))}
            class="btn btn--ghost"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
