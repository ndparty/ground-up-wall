import { define } from "../../../../utils.ts";

export const handlers = define.handlers({
  async GET(ctx) {
    const moderators = await ctx.state.services.photoWall.listModerators();
    const displayUsers = await ctx.state.services.photoWall.listDisplayWallUsers();
    const users = [
      ...moderators.map((m) => ({
        id: m.id,
        username: m.username,
        role: "moderator" as const,
        disabled: m.disabled,
        created_at: m.created_at,
      })),
      ...displayUsers.map((u) => ({
        id: u.id,
        username: u.username,
        role: "display_wall" as const,
        disabled: u.disabled,
        created_at: u.created_at,
      })),
    ];
    return ctx.json(users);
  },
});
