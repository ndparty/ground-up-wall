import type { AuditFilter } from "../../../../lib/types.ts";
import { define } from "../../../../utils.ts";

const DEFAULT_PAGE_SIZE = 50;

export const handlers = define.handlers({
  async GET(ctx) {
    const url = new URL(ctx.req.url);
    const filters: AuditFilter = {};
    const moderatorId = url.searchParams.get("moderator_id");
    const actionType = url.searchParams.get("action_type");
    const targetType = url.searchParams.get("target_type");
    const dateFrom = url.searchParams.get("date_from");
    const dateTo = url.searchParams.get("date_to");
    const limit = Number.parseInt(url.searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10);
    const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);

    if (moderatorId) filters.moderator_id = moderatorId;
    if (actionType) filters.action_type = actionType;
    if (targetType) filters.target_type = targetType;
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;

    const page = await ctx.state.services.photoWall.getAuditLogPage(
      filters,
      Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : DEFAULT_PAGE_SIZE,
      Number.isFinite(offset) && offset >= 0 ? offset : 0,
    );
    return ctx.json(page);
  },
});
