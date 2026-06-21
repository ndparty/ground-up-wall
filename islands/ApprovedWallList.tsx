import { useMemo, useState } from "preact/hooks";
import type { Submission } from "../lib/types.ts";
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(DEFAULT_PAGE_SIZE);

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

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handlePageSizeChange(value: PageSizeOption) {
    setPageSize(value);
    setPage(1);
  }

  if (approved.length === 0) {
    return <p style="color: #666;">No approved submissions</p>;
  }

  return (
    <div>
      <div style="margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center;">
        <label style="display: flex; flex-direction: column; gap: 0.25rem; flex: 1; min-width: 200px;">
          <span style="font-size: 0.85rem; color: #666;">Search approved</span>
          <input
            type="search"
            value={search}
            placeholder="Message, name, handle, or id…"
            aria-label="Search approved submissions"
            onInput={(e) => handleSearchChange((e.target as HTMLInputElement).value)}
            style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;"
          />
        </label>
        <label style="display: flex; flex-direction: column; gap: 0.25rem;">
          <span style="font-size: 0.85rem; color: #666;">Per page</span>
          <select
            value={pageSize}
            aria-label="Entries per page"
            onChange={(e) => {
              const raw = (e.target as HTMLSelectElement).value;
              handlePageSizeChange(
                raw === "all" ? "all" : Number(raw) as PageSizeOption,
              );
            }}
            style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; background: white;"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {pageSizeLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <p style="margin: 0; font-size: 0.85rem; color: #666; align-self: flex-end; padding-bottom: 0.5rem;">
          {filtered.length} result{filtered.length === 1 ? "" : "s"}
          {search.trim() ? ` (of ${approved.length})` : ""}
        </p>
      </div>

      {pageItems.length === 0 ? <p style="color: #666;">No matches</p> : pageItems.map((sub) => {
        const cabin = cabinNumberFor(sub, approved);
        return (
          <SubmissionCard
            key={sub.id}
            submission={sub}
            showDelete
            cabinNumber={cabin}
            lazyImage
            onEdit={async (data) => onEdit(sub, data)}
            onDelete={async () => onDelete(sub)}
            onShowOnDisplay={async () => onShowOnDisplay(cabin)}
          />
        );
      })}

      {pageSize !== "all" && totalPages > 1 && (
        <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 1rem;">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style="padding: 0.4rem 0.8rem; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer;"
          >
            Previous
          </button>
          <span style="font-size: 0.9rem; color: #666;">
            Page {safePage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            style="padding: 0.4rem 0.8rem; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer;"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
