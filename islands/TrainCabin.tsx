import { forwardRef } from "preact/compat";
import { useLayoutEffect, useRef } from "preact/hooks";
import type { Submission } from "../lib/types.ts";
import { qrCodeDataUrl } from "../lib/qr/qr_code.ts";
import {
  QR_CABIN_DESTINATION,
  QR_CABIN_MESSAGE,
  QR_CABIN_NAME,
} from "../lib/defaults/app_defaults.ts";
import { pickDecorativeLineBadge } from "../lib/copy/station_sign.ts";
import { useFitText, fitTextClass, fitTextDataRem } from "../lib/hooks/use_fit_text.ts";

/** Production roof sign style — change after preview at /roof-badge-preview.html */
export const CABIN_SIGN_VARIANT = "b" as "a" | "b" | "c" | "simple";

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

function StationSign({ name, variant }: { name: string; variant: typeof CABIN_SIGN_VARIANT }) {
  const badge = pickDecorativeLineBadge(name);

  if (variant === "a") {
    return (
      <div class={`train-cabin__sign train-cabin__sign--a`}>
        <span class="train-cabin__sign-logo" aria-hidden="true" />
        <span class="train-cabin__sign-line-badge" aria-hidden="true">{badge.primary}</span>
        <span class="train-cabin__sign-name">{name}</span>
        <span class="train-cabin__sign-transit" aria-hidden="true">
          <span class="train-cabin__sign-transit-mrt">M</span>
          <span class="train-cabin__sign-transit-bus">B</span>
        </span>
      </div>
    );
  }

  if (variant === "b") {
    return (
      <div class={`train-cabin__sign train-cabin__sign--b`}>
        <span class="train-cabin__sign-logo" aria-hidden="true" />
        <span class="train-cabin__sign-bus-icon" aria-hidden="true" />
        <span class="train-cabin__sign-name">{name}</span>
        <span class="train-cabin__sign-line-pill" aria-hidden="true">
          <span class="train-cabin__sign-line-ns">{badge.primary}</span>
          {badge.secondary && <span class="train-cabin__sign-line-te">{badge.secondary}</span>}
        </span>
        <span class="train-cabin__sign-exit" aria-hidden="true">{badge.exit}</span>
      </div>
    );
  }

  if (variant === "c") {
    return (
      <div class={`train-cabin__sign train-cabin__sign--c`}>
        <span class="train-cabin__sign-logo-frame" aria-hidden="true">
          <span class="train-cabin__sign-logo" />
          <span class="train-cabin__sign-mrt-label">MRT</span>
        </span>
        <span class="train-cabin__sign-line-pill" aria-hidden="true">
          <span class="train-cabin__sign-line-ns">{badge.primary}</span>
          {badge.secondary && <span class="train-cabin__sign-line-te">{badge.secondary}</span>}
        </span>
        <span class="train-cabin__sign-name">{name}</span>
        <span class="train-cabin__sign-exit" aria-hidden="true">{badge.platform}</span>
      </div>
    );
  }

  return (
    <div class={`train-cabin__sign train-cabin__sign--simple`}>
      <span class="train-cabin__sign-logo" aria-hidden="true" />
      <span class="train-cabin__sign-name">{name}</span>
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
  const signVariant = kind === "qr" ? "simple" : CABIN_SIGN_VARIANT;
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
