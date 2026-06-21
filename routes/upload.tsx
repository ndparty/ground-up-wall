import { page } from "fresh";
import UploadForm from "../islands/UploadForm.tsx";
import { UPLOAD_FOOTER_NOTE } from "../lib/copy/disclaimers.ts";
import { getUploadFormConfig } from "../lib/upload_config.ts";
import { define } from "../utils.ts";

export const handlers = define.handlers({
  async GET(ctx) {
    const config = await getUploadFormConfig(ctx.state.services.photoWall);
    return page(config);
  },
});

export default define.page<typeof handlers>(function UploadPage({ data }) {
  return (
    <div class="page page--upload">
      <h2 class="heading-brand--center">Share your moment!</h2>
      <UploadForm
        messagePromptText={data.messagePromptText}
        messageLengthLimit={data.messageLengthLimit}
        messageLengthUnit={data.messageLengthUnit}
      />
      {UPLOAD_FOOTER_NOTE && (
        <p class="text-subtle--center">
          {UPLOAD_FOOTER_NOTE}
        </p>
      )}
    </div>
  );
});
