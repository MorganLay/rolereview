export type QuestionCardPhase =
  | { phase: "prepare" }
  | { phase: "failed" }
  | { phase: "refresh" }
  | { phase: "ask"; count: number; refresh: boolean }
  | { phase: "review"; count: number }
  | { phase: "saved"; count: number };

export type JobQuestionView = {
  id: string;
  position: number;
  kind: "confirm" | "detail" | "scale" | "outcome" | "role";
  question: string;
  why: string;
  about: string | null;
  requirementId: string;
  status: "OPEN" | "YES" | "NOT_YET" | "SKIPPED";
  detail: string;
  followUp: string | null;
  followUpDetail: string;
  draftText: string | null;
  draftDestination: "BULLET" | "SKILL" | "CERTIFICATION" | null;
  draftDropped: boolean;
  destinationLabel: string | null;
};

export type AnswerOriginView = {
  id: string;
  question: string;
  answer: string;
  answeredLabel: string;
  bulletId: string | null;
  skillId: string | null;
  entryId: string | null;
};
