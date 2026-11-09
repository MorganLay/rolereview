import { describe, expect, it } from "vitest";

import { reviewRewrite } from "@/features/library/rewrite-guard";
import {
  confirmedFromAnswers,
  formatConfirmedAnswer,
  mergeConfirmed,
} from "@/features/library/strengthen-confirm";

const library = [
  "Bachelor of Computer Science, Honours",
  "Carleton University",
  "Coursework in software engineering, database management, web security, machine learning, and AI.",
  "Built a bike-route maps app for a Carleton software engineering project, implementing the map API integration.",
  "Implemented and tested a convolutional neural network in Python and TensorFlow for COVID-19 detection from radiographs, achieving 95% classification accuracy.",
];

describe("formatConfirmedAnswer", () => {
  it("turns a yes into an affirmative fact the guard can match", () => {
    expect(formatConfirmedAnswer("Did you lead a study group?", "")).toBe(
      "Confirmed: Lead a study group.",
    );
  });

  it("keeps the person's elaboration as authoritative detail", () => {
    expect(
      formatConfirmedAnswer(
        "Did you check error types, such as how often COVID-19 cases were missed?",
        "Reviewed false negatives and false positives on the radiograph set.",
      ),
    ).toBe(
      "Confirmed: Check error types, such as how often COVID-19 cases were missed. Detail: Reviewed false negatives and false positives on the radiograph set.",
    );
  });

  it("strips a leading Beyond-clause before affirming", () => {
    expect(
      formatConfirmedAnswer(
        "Beyond overall accuracy, did you check error types?",
        "Looked at missed cases.",
      ),
    ).toBe("Confirmed: Check error types. Detail: Looked at missed cases.");
  });
});

describe("confirmedFromAnswers", () => {
  it("includes only yes answers and formats them", () => {
    expect(
      confirmedFromAnswers([
        { question: "Did you lead a study group?", yes: true, detail: "Weekly reviews." },
        { question: "Did you tutor paid students?", yes: false, detail: "" },
        { question: "Did you present at a seminar?", yes: null, detail: "" },
      ]),
    ).toEqual(["Confirmed: Lead a study group. Detail: Weekly reviews."]);
  });
});

describe("mergeConfirmed", () => {
  it("keeps first-round elaborations when follow-ups are answered", () => {
    const first = confirmedFromAnswers([
      {
        question: "Did you lead a study group?",
        yes: true,
        detail: "Met weekly to review assignments with classmates.",
      },
    ]);
    const second = confirmedFromAnswers([
      {
        question: "About how many classmates joined those weekly reviews?",
        yes: true,
        detail: "Usually 4 classmates.",
      },
    ]);
    const merged = mergeConfirmed(first, second);
    expect(merged).toEqual([
      "Confirmed: Lead a study group. Detail: Met weekly to review assignments with classmates.",
      "Confirmed: About how many classmates joined those weekly reviews. Detail: Usually 4 classmates.",
    ]);
  });

  it("replaces an earlier answer when the same question is confirmed again", () => {
    const first = [
      "Confirmed: Lead a study group. Detail: Met sometimes.",
    ];
    const second = [
      "Confirmed: Lead a study group. Detail: Met weekly with 4 classmates.",
    ];
    expect(mergeConfirmed(first, second)).toEqual([
      "Confirmed: Lead a study group. Detail: Met weekly with 4 classmates.",
    ]);
  });
});

describe("strengthen draft guard with confirmed elaborations", () => {
  it("keeps a draft grounded in the person's confirmed detail", () => {
    const confirmed = confirmedFromAnswers([
      {
        question: "Did you lead a study group for software engineering?",
        yes: true,
        detail: "Met weekly with classmates to review assignments.",
      },
    ]);
    const result = reviewRewrite({
      text: "Led a weekly study group with classmates to review software engineering assignments.",
      why: "Uses the confirmed study-group detail.",
      question: null,
      original: "",
      evidence: [...library, ...confirmed],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toContain("study group");
  });

  it("keeps a follow-up draft when first-round confirmations stay in evidence", () => {
    const first = confirmedFromAnswers([
      {
        question: "Beyond overall accuracy, did you check error types?",
        yes: true,
        detail: "Reviewed false negatives for missed COVID-19 cases.",
      },
    ]);
    const second = confirmedFromAnswers([
      {
        question: "Did that review change how the model was evaluated?",
        yes: true,
        detail: "Added an error-type breakdown beside overall accuracy.",
      },
    ]);
    const confirmed = mergeConfirmed(first, second);
    const result = reviewRewrite({
      text: "Reviewed false negatives for missed COVID-19 cases and added an error-type breakdown beside overall accuracy.",
      why: "Combines both confirmed answers.",
      question: null,
      original: "",
      evidence: [...library, ...confirmed],
    });
    expect(result.ok).toBe(true);
  });

  it("still drops a draft that invents a tool the person did not confirm", () => {
    const confirmed = confirmedFromAnswers([
      {
        question: "Did you lead a study group?",
        yes: true,
        detail: "Met weekly to review assignments.",
      },
    ]);
    const result = reviewRewrite({
      text: "Led a weekly study group in PostgreSQL for classmates.",
      why: "Names a database that was never confirmed.",
      question: null,
      original: "",
      evidence: [...library, ...confirmed],
    });
    expect(result.ok).toBe(false);
  });

  it("allows a confirmed number from the person's detail", () => {
    const confirmed = confirmedFromAnswers([
      {
        question: "About how many classmates joined?",
        yes: true,
        detail: "Usually 4 classmates.",
      },
    ]);
    const result = reviewRewrite({
      text: "Met with 4 classmates in a weekly study group.",
      why: "Uses the confirmed count.",
      question: null,
      original: "",
      evidence: [...library, ...confirmed],
    });
    expect(result.ok).toBe(true);
  });

  it("preserves first-round elaboration text in merged evidence for the draft call", () => {
    const first = confirmedFromAnswers([
      {
        question: "Beyond overall accuracy, did you check error types?",
        yes: true,
        detail: "Reviewed false negatives for missed COVID-19 cases.",
      },
    ]);
    const second = confirmedFromAnswers([
      {
        question: "Did that review change how the model was evaluated?",
        yes: true,
        detail: "Added an error-type breakdown beside overall accuracy.",
      },
    ]);
    const merged = mergeConfirmed(first, second).join("\n");
    expect(merged).toMatch(/false negatives/i);
    expect(merged).toMatch(/error-type breakdown/i);
    // Old bug: sending only the follow-up round lost the elaboration.
    expect(second.join("\n")).not.toMatch(/false negatives/i);
  });
});

