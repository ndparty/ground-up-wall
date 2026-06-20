import { forwardRef } from "preact/compat";
import type { Submission } from "../lib/types.ts";

export interface TrainCabinProps {
  submission: Submission;
  isActive: boolean;
  index: number;
  lazyImage?: boolean;
  onPhotoError?: () => void;
}

const TrainCabin = forwardRef<HTMLElement, TrainCabinProps>(function TrainCabin(
  { submission, isActive, index, lazyImage = false, onPhotoError },
  ref,
) {
  return (
    <article
      ref={ref}
      class={`train-cabin${isActive ? " train-cabin--active" : ""}`}
      data-cabin-index={index}
      aria-hidden={!isActive}
    >
      <div class="train-cabin__roof" aria-hidden="true">
        <span class="train-cabin__line">National Day Special</span>
      </div>
      <div class="train-cabin__window">
        <div class="train-cabin__photo-wrap">
          <img
            class="train-cabin__photo"
            src={submission.image_url}
            alt={`Photo by ${submission.submitter_name}`}
            loading={lazyImage ? "lazy" : "eager"}
            decoding="async"
            onError={onPhotoError}
          />
        </div>
      </div>
      <div class="train-cabin__body">
        <p class="train-cabin__message">{submission.message}</p>
        <p class="train-cabin__name">{submission.submitter_name}</p>
        {submission.social_handle && (
          <p class="train-cabin__handle">{submission.social_handle}</p>
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
