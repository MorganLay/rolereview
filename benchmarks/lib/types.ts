export const FITS = ["strong", "adjacent", "stretch"] as const;
export type Fit = (typeof FITS)[number];

export type BenchmarkCase = {
  id: string;
  candidateId: string;
  jobId: string;
  profession: string;
  seniority: string;
  fit: Fit;
  capabilities: string[];
  whyCandidate: string;
  whyJob: string;
  success: string;
  failureModes: string[];
  whyItMatters: string;
  includeEvidence: string[];
  avoidClaims: string[];
};

export type ScoreConfidence = "high" | "medium" | "low" | "unreviewed";

export type DimensionScore = {
  score: number | null;
  max: number;
  rationale: string;
  evidenceIds: string[];
  confidence: ScoreConfidence;
};

export type ArmEvaluation = {
  arm: "roleRefine" | "baseline";
  factual: DimensionScore;
  relevance: DimensionScore;
  writing: DimensionScore;
  prioritization: DimensionScore;
  formatting: DimensionScore;
  criticalFabrication: boolean | null;
};

export const RUBRIC = [
  { key: "factual", label: "Factual accuracy and evidentiary support", max: 30 },
  { key: "relevance", label: "Relevance to the target job", max: 25 },
  { key: "writing", label: "Writing quality, clarity, and specificity", max: 20 },
  { key: "prioritization", label: "Prioritization of strongest experience", max: 15 },
  { key: "formatting", label: "Structure, readability, and ATS compatibility", max: 10 },
] as const;
