export type WordingView = {
  id: string;
  kind: "BULLET" | "HEADLINE" | "SUMMARY";
  status: "PROPOSED" | "APPROVED";
  origin: "CANONICAL" | "REWRITE" | "STRENGTHEN" | "USER" | "JOB";
  bulletId: string | null;
  jobId: string | null;
  jobLabel: string | null;
  text: string;
  reason: string | null;
  sourceRefs: string[];
  isDefault: boolean;
};
