import { forwardRef } from "preact/compat";
import type { Submission } from "../lib/types.ts";
import { qrCodeSvg } from "../lib/qr/qr_code.ts";

export interface TrainCabinProps {
  kind: "post" | "qr";
  submission?: Submission;
  isActive: boolean;
  /** Host shown as text on the QR cabin / join bar (e.g. "wall.example.com"). */
  baseUrl?: string;
  /** Full origin encoded into the QR code (e.g. "https://wall.example.com"). */
  qrUrl?: string;
  onPhotoError?: () => void;
}

const TrainCabin = forwardRef<HTMLElement, TrainCabinProps>(function TrainCabin(
  { kind, submission, isActive, baseUrl, qrUrl, onPhotoError },
  ref,
) {
  const roofLabel = kind === "qr" ? "Join the wall" : "National Day Special";

  return (
    <article
      ref={ref}
      class={`train-cabin${isActive ? " train-cabin--active" : ""}${
        kind === "qr" ? " train-cabin--qr" : ""
      }`}
      aria-hidden={!isActive}
    >
      <div class="train-cabin__roof" aria-hidden="true">
        <span class="train-cabin__line">{roofLabel}</span>
      </div>
      <div class="train-cabin__window">
        {kind === "qr"
          ? (
            <div class="train-cabin__qr">
              <div
                class="train-cabin__qr-code"
                dangerouslySetInnerHTML={{ __html: qrUrl ? qrCodeSvg(qrUrl) : "" }}
              />
              {baseUrl && <p class="train-cabin__qr-url">{baseUrl}</p>}
            </div>
          )
          : (
            <div class="train-cabin__photo-wrap">
              {submission && (
                <img
                  class="train-cabin__photo"
                  src={submission.image_url}
                  alt={`Photo by ${submission.submitter_name}`}
                  decoding="async"
                  onError={onPhotoError}
                />
              )}
            </div>
          )}
      </div>
      <div class="train-cabin__body">
        {kind === "qr"
          ? (
            <>
              <p class="train-cabin__message">Hop on the wall!</p>
              <p class="train-cabin__name">Scan to share your National Day photo</p>
            </>
          )
          : (
            <>
              <p class="train-cabin__message">{submission?.message}</p>
              <p class="train-cabin__name">{submission?.submitter_name}</p>
              {submission?.social_handle && (
                <p class="train-cabin__handle">{submission.social_handle}</p>
              )}
            </>
          )}
      </div>
      <div class="train-cabin__undercarriage" aria-hidden="true">
        <span class="train-cabin__bogie" />
        <span class="train-cabin__bogie" />
      </div>
    </article>
  );
});

export default TrainCabin;
