import { getUploadFormConfig } from "../../../lib/upload_config.ts";
import { define } from "../../../utils.ts";

export const handlers = define.handlers({
  async GET(ctx) {
    const config = await getUploadFormConfig(ctx.state.services.photoWall);
    return ctx.json(config);
  },
});
