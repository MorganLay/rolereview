import { strings } from "@/copy/strings";

import { JOB_LIMITS } from "./schemas";

const copy = strings.jobs;

export type PostingStatus = {
  text: string;
  /** Over the maximum only. A short posting is guidance, not an error state. */
  invalid: boolean;
  /** Spoken when guidance or an error appears. Empty while the line is only a count. */
  live: string;
};

/** One footer line: the count, the required range, or the validation note. */
export function postingStatus(count: number, revealShort: boolean): PostingStatus {
  const counted = copy.postingCount(count);
  if (count > JOB_LIMITS.postingMax) {
    return {
      text: `${counted} · ${copy.errors.postingLong}`,
      invalid: true,
      live: copy.errors.postingLong,
    };
  }
  if (revealShort && count > 0 && count < JOB_LIMITS.postingMin) {
    return {
      text: `${counted} · ${copy.errors.postingShort}`,
      invalid: false,
      live: copy.errors.postingShort,
    };
  }
  return {
    text: `${counted} · ${copy.postingRange}`,
    invalid: false,
    live: "",
  };
}
