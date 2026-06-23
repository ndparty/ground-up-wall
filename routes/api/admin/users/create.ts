import { toPublicError } from "../../../../lib/api/public_error.ts";
import { validatePassword } from "../../../../lib/security/password_policy.ts";
import { define } from "../../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
    const admin = ctx.state.user!;
    const { username, password, role } = await ctx.req.json() as {
      username: string;
      password: string;
      role: "moderator" | "display_wall";
    };

    if (!username?.trim() || !password) {
      return ctx.json({ error: "Username and password are required" }, { status: 400 });
    }
    if (role !== "moderator" && role !== "display_wall") {
      return ctx.json({ error: "Invalid role" }, { status: 400 });
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      return ctx.json({ error: passwordError }, { status: 400 });
    }

    const existing = await ctx.state.services.repository.authenticateUser(username.trim());
    if (existing) {
      return ctx.json({ error: "Could not create user" }, { status: 409 });
    }

    try {
      if (role === "moderator") {
        await ctx.state.services.photoWall.createModerator(username.trim(), password, admin.id);
      } else {
        await ctx.state.services.photoWall.createDisplayWallUser(
          username.trim(),
          password,
          admin.id,
        );
      }
      return ctx.json({ ok: true }, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("unique") || message.includes("duplicate")) {
        return ctx.json({ error: "Could not create user" }, { status: 409 });
      }
      return ctx.json({ error: toPublicError(err, "Create failed") }, { status: 400 });
    }
  },
});
