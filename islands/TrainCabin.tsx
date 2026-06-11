import type { Submission } from "../lib/types.ts";

export interface TrainCabinProps {
  submission: Submission;
  isActive: boolean;
  index: number;
}

export default function TrainCabin({ submission, isActive, index }: TrainCabinProps) {
  return (
    <article
      class={`train-cabin${isActive ? " train-cabin--active" : ""}`}
      data-cabin-index={index}
      aria-hidden={!isActive}
    >
      <div class="train-cabin__photo-wrap">
        <img
          class="train-cabin__photo"
          src={submission.image_url}
          alt={`Photo by ${submission.submitter_name}`}
        />
      </div>
      <div class="train-cabin__body">
        <p class="train-cabin__message">{submission.message}</p>
        <p class="train-cabin__name">{submission.submitter_name}</p>
        {submission.social_handle && (
          <p class="train-cabin__handle">{submission.social_handle}</p>
        )}
      </div>
    </article>
  );
}
