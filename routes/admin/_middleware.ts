import { requireRolePage } from "../../lib/middleware/auth_guard.ts";

export const handler = [requireRolePage("admin")];
