import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { questionProblems, selectJobQuestions } from "@/features/questions/filter";
import { reviewDraftLine } from "@/features/questions/draft-guard";
import { libraryRevision } from "@/features/questions/revision";
import { roleVerbAllowed } from "@/features/questions/role-verb";
import { runOfflineCases } from "../../evals/questions/offline";

describe("question filters", () => {
  it("passes the offline cases, including a role question", () => {
    const results = runOfflineCases();
    expect(results.map((result) => result.id)).toEqual([
      "sparse",
      "rich",
      "licence",
      "one-line",
      "nothing",
      "prior-no",
      "presuppose",
      "unstated-tool",
      "same-topic",
      "role",
    ]);
    const failed = results.filter((result) => !result.pass);
    expect(failed).toEqual([]);
  });

  it("drops a protected characteristic and a number the library does not state", () => {
    const input = {
      requirements: [{ id: "r1", text: "Team leadership", importance: "must" as const, kind: "experience" }],
      entries: [{ ref: "E1", id: "e1", title: "Lead", bullets: ["Coordinated the weekly plan."] }],
      libraryText: "Coordinated the weekly plan.",
      postingText: "Team leadership.",
      knownTopicKeys: new Set<string>(),
    };
    expect(
      questionProblems(
        {
          requirementId: "r1",
          entryRef: "E1",
          kind: "confirm",
          subject: "age",
          topicKey: null,
          question: "What is your age?",
          why: "The posting asks for leadership.",
        },
        input,
      ),
    ).toContain("protected");
    expect(
      questionProblems(
        {
          requirementId: "r1",
          entryRef: "E1",
          kind: "scale",
          subject: "team size",
          topicKey: null,
          question: "Did you coordinate a team of 12?",
          why: "The posting asks for leadership.",
        },
        input,
      ),
    ).toContain("number");
    expect(selectJobQuestions({ ...input, proposed: [] })).toEqual([]);
  });
});

describe("role verbs and drafts", () => {
  it("keeps the verb the person used and rejects a stronger one", () => {
    expect(roleVerbAllowed("Reviewed generated routes for the booking site.", "I reviewed the generated routes.")).toBe(
      true,
    );
    expect(roleVerbAllowed("Built the booking API.", "I reviewed the generated routes.")).toBe(false);
    expect(roleVerbAllowed("Wrote the validation.", "I wrote the validation and reviewed the schema.")).toBe(true);
    expect(roleVerbAllowed("Directed the project.", "I wrote the validation.")).toBe(false);
  });

  it("runs the rewrite guard and drops a number the answer did not type", () => {
    const dropped = reviewDraftLine({
      text: "Reviewed 40 generated routes for the booking site.",
      answer: "I reviewed the generated routes.",
      evidence: ["Shipped the booking site with Cursor and a coding agent."],
      kind: "role",
    });
    expect(dropped.ok).toBe(false);
    const kept = reviewDraftLine({
      text: "Reviewed generated routes for the booking site.",
      answer: "I reviewed the generated routes.",
      evidence: ["Shipped the booking site with Cursor and a coding agent."],
      kind: "role",
    });
    expect(kept.ok).toBe(true);
  });
});

describe("library revision", () => {
  it("changes when a bullet or skill changes and ignores order", () => {
    const left = libraryRevision({
      entries: [{ id: "b", updatedAt: "t1", bullets: [{ id: "x", updatedAt: "t2" }] }],
      skills: [{ id: "s", name: "SQL" }],
    });
    const right = libraryRevision({
      entries: [{ id: "b", updatedAt: "t1", bullets: [{ id: "x", updatedAt: "t2" }] }],
      skills: [{ id: "s", name: "SQL" }],
    });
    expect(left).toBe(right);
    expect(
      libraryRevision({
        entries: [{ id: "b", updatedAt: "t1", bullets: [{ id: "x", updatedAt: "t3" }] }],
        skills: [{ id: "s", name: "SQL" }],
      }),
    ).not.toBe(left);
  });
});

describe("account deletion cascades", () => {
  it("cascades the four question tables with the user", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    for (const model of ["JobQuestionSet", "JobQuestion", "AnswerTopic", "EvidenceOrigin"]) {
      const block = schema.split(`model ${model} `)[1]?.split(/\nmodel /)[0] ?? "";
      expect(block).toMatch(/user\s+User\s+@relation\([\s\S]*onDelete:\s*Cascade/);
    }
  });
});
