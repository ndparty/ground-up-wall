import { requireRole } from "../../../lib/middleware/auth_guard.ts";

export const handler = [requireRole("admin")];
