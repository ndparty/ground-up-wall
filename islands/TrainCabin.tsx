import { forwardRef } from "preact/compat";
import { useLayoutEffect, useRef } from "preact/hooks";
import type { Submission } from "../lib/types.ts";
import { qrCodeDataUrl } from "../lib/qr/qr_code.ts";
import {
  QR_CABIN_DESTINATION,
  QR_CABIN_MESSAGE,
  QR_CABIN_NAME,
} from "../lib/defaults/app_defaults.ts";
import { stationLineBadges } from "../lib/copy/station_lines.ts";
import { fitTextClass, fitTextDataRem, useFitText } from "../lib/hooks/use_fit_text.ts";

export interface TrainCabinProps {
  kind: "post" | "qr";
  submission?: Submission;
  /** Destination-board label on the roof band. */
  destination?: string;
  isActive: boolean;
  /** Suppress opacity transition while the track is sliding. */
  isAnimating?: boolean;
  /** Full origin encoded into the QR code (e.g. "https://wall.example.com"). */
  qrUrl?: string;
  onPhotoError?: () => void;
}

/**
 * Roof station sign modelled on real Singapore MRT signage: station name
 * left-aligned in normal case, real line designators (any count) concatenated
 * in a white-bordered pill on the right. QR cabins keep the "simple" variant.
 */
function StationSign({ name, variant }: { name: string; variant: "station" | "simple" }) {
  if (variant === "simple") {
    return (
      <div class={`train-cabin__sign train-cabin__sign--simple`}>
        <span class="train-cabin__sign-logo" aria-hidden="true" />
        <span class="train-cabin__sign-name">{name}</span>
      </div>
    );
  }

  const badges = stationLineBadges(name);
  return (
    <div class={`train-cabin__sign train-cabin__sign--station`}>
      <span class="train-cabin__sign-name">{name}</span>
      {badges.length > 0 && (
        <span class="train-cabin__sign-line-pill" aria-hidden="true">
          {badges.map((badge) => (
            <span
              key={badge.code}
              class={`train-cabin__sign-line-seg train-cabin__sign-line-seg--${badge.line}`}
            >
              {badge.code}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

const TrainCabin = forwardRef<HTMLElement, TrainCabinProps>(function TrainCabin(
  { kind, submission, destination, isActive, isAnimating, qrUrl, onPhotoError },
  ref,
) {
  const roofLabel = kind === "qr" ? QR_CABIN_DESTINATION : (destination ?? "—");
  const messageText = kind === "qr" ? QR_CABIN_MESSAGE : (submission?.message ?? "");
  const { wrapRef, textRef, sizeRem, refit } = useFitText(messageText, kind === "post");
  const signVariant = kind === "qr" ? "simple" as const : "station" as const;
  const wasActiveRef = useRef(isActive);

  useLayoutEffect(() => {
    if (kind !== "post") return;
    if (isActive && !wasActiveRef.current) refit();
    wasActiveRef.current = isActive;
  }, [isActive, kind, refit]);

  return (
    <div
      ref={ref}
      class={`train-cabin-wrap${isActive ? " train-cabin-wrap--active" : ""}${
        isAnimating ? " train-cabin-wrap--animating" : ""
      }${kind === "qr" ? " train-cabin-wrap--qr" : ""}`}
      aria-hidden={!isActive}
    >
      <article class="train-cabin">
        <div class="train-cabin__roof" aria-hidden="true">
          <StationSign name={roofLabel} variant={signVariant} />
        </div>
        <div class="train-cabin__window">
          {kind === "qr"
            ? (
              <div class="train-cabin__qr">
                {qrUrl && (
                  <img
                    class="train-cabin__qr-code"
                    src={qrCodeDataUrl(qrUrl)}
                    alt="Upload QR code"
                    decoding="async"
                  />
                )}
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
                    onLoad={refit}
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
                <p class="train-cabin__message">{QR_CABIN_MESSAGE}</p>
                <p class="train-cabin__name train-cabin__name--qr">{QR_CABIN_NAME}</p>
              </>
            )
            : (
              <>
                <div class="train-cabin__message-wrap" ref={wrapRef}>
                  <p
                    ref={textRef}
                    class={`train-cabin__message ${fitTextClass(sizeRem)}`}
                    data-fit-rem={fitTextDataRem(sizeRem)}
                  >
                    {submission?.message}
                  </p>
                </div>
                <p class="train-cabin__name">{submission?.submitter_name}</p>
                {submission?.social_handle && (
                  <p class="train-cabin__handle">{submission.social_handle}</p>
                )}
              </>
            )}
        </div>
      </article>
      <div class="train-cabin__undercarriage" aria-hidden="true">
        <span class="train-cabin__bogie" />
        <span class="train-cabin__bogie" />
      </div>
    </div>
  );
});

export default TrainCabin;
