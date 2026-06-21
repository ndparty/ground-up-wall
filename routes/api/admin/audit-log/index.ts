import type { AuditFilter } from "../../../../lib/types.ts";
import { define } from "../../../../utils.ts";

export const handlers = define.handlers({
  async GET(ctx) {
    const url = new URL(ctx.req.url);
    const filters: AuditFilter = {};
    const moderatorId = url.searchParams.get("moderator_id");
    const actionType = url.searchParams.get("action_type");
    const targetType = url.searchParams.get("target_type");
    const dateFrom = url.searchParams.get("date_from");
    const dateTo = url.searchParams.get("date_to");

    if (moderatorId) filters.moderator_id = moderatorId;
    if (actionType) filters.action_type = actionType;
    if (targetType) filters.target_type = targetType;
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;

    const entries = await ctx.state.services.photoWall.getAuditLog(filters);
    return ctx.json(entries);
  },
});
