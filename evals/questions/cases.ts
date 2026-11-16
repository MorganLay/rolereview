/**
 * Offline cases for question filters. Fake people only.
 * The live eval uses the same libraries and postings.
 */

export type QuestionCase = {
  id: string;
  libraryText: string;
  postingText: string;
  entries: { ref: string; id: string; title: string; bullets: string[] }[];
  requirements: { id: string; text: string; importance: "must" | "nice"; kind: string }[];
  known: { subject: string; entryId: string | null }[];
  proposed: {
    requirementId: string;
    entryRef: string | null;
    kind: string;
    subject: string;
    topicKey: string | null;
    question: string;
    why: string;
  }[];
  kept: string[];
  drafts?: { answer: string; text: string; allow: boolean }[];
};

const why = "The posting asks for this.";

export const QUESTION_CASES: QuestionCase[] = [
  {
    id: "sparse",
    libraryText: "E1 | EXPERIENCE | Crew member\n  Made fries and cooked food during dinner service.",
    postingText: "Food-safe handling is required during a busy meal service.",
    entries: [
      {
        ref: "E1",
        id: "e-sparse",
        title: "Crew member",
        bullets: ["Made fries and cooked food during dinner service."],
      },
    ],
    requirements: [
      { id: "r1", text: "Food-safe handling", importance: "must", kind: "experience" },
      { id: "r2", text: "Busy meal service", importance: "must", kind: "experience" },
    ],
    known: [],
    proposed: [
      {
        requirementId: "r1",
        entryRef: null,
        kind: "confirm",
        subject: "food-safe handling",
        topicKey: null,
        question: "Do you hold a food-safe handling credential?",
        why,
      },
      {
        requirementId: "r2",
        entryRef: "E1",
        kind: "detail",
        subject: "busy meal period",
        topicKey: null,
        question: "In the crew role, did you work a busy meal period?",
        why,
      },
      {
        requirementId: "r2",
        entryRef: "E1",
        kind: "detail",
        subject: "thermometer",
        topicKey: null,
        question: "Did you use a HACCP thermometer during dinner service?",
        why,
      },
    ],
    kept: [
      "Do you hold a food-safe handling credential?",
      "In the crew role, did you work a busy meal period?",
    ],
  },
  {
    id: "rich",
    libraryText:
      "E1 | EXPERIENCE | RoleRefine\n  Designed REST API routes, including validation and error responses, for the booking service.",
    postingText: "RESTful API design and booking volume.",
    entries: [
      {
        ref: "E1",
        id: "e-rich",
        title: "RoleRefine",
        bullets: [
          "Designed REST API routes, including validation and error responses, for the booking service.",
        ],
      },
    ],
    requirements: [
      { id: "r1", text: "RESTful API design", importance: "must", kind: "experience" },
      { id: "r2", text: "Booking volume", importance: "nice", kind: "experience" },
    ],
    known: [],
    proposed: [
      {
        requirementId: "r1",
        entryRef: "E1",
        kind: "confirm",
        subject: "REST API routes",
        topicKey: null,
        question: "Did you design REST API routes, including validation and error responses?",
        why,
      },
      {
        requirementId: "r2",
        entryRef: "E1",
        kind: "scale",
        subject: "booking conflicts",
        topicKey: null,
        question: "How often did that booking service hit a conflict?",
        why,
      },
    ],
    kept: ["How often did that booking service hit a conflict?"],
  },
  {
    id: "licence",
    libraryText: "E1 | EXPERIENCE | Analyst\n  Built monthly reports in Excel.",
    postingText: "A P.Eng. licence is required. AutoCAD is not mentioned as held by the candidate.",
    entries: [
      {
        ref: "E1",
        id: "e-licence",
        title: "Analyst",
        bullets: ["Built monthly reports in Excel."],
      },
    ],
    requirements: [
      { id: "r1", text: "P.Eng. licence", importance: "must", kind: "certification" },
      { id: "r2", text: "Excel reporting", importance: "must", kind: "skill" },
    ],
    known: [],
    proposed: [
      {
        requirementId: "r1",
        entryRef: null,
        kind: "confirm",
        subject: "P.Eng. licence",
        topicKey: null,
        question: "Do you hold a P.Eng. licence?",
        why: "The posting asks for a P.Eng. licence.",
      },
      {
        requirementId: "r2",
        entryRef: "E1",
        kind: "detail",
        subject: "drawings",
        topicKey: null,
        question: "Did you use AutoCAD for those reports?",
        why,
      },
    ],
    kept: ["Do you hold a P.Eng. licence?"],
  },
  {
    id: "one-line",
    libraryText: "E1 | EXPERIENCE | Analyst\n  Wrote SQL queries for the monthly close.\nSKILLS\n  SQL",
    postingText: "SQL is required.",
    entries: [
      {
        ref: "E1",
        id: "e-one-line",
        title: "Analyst",
        bullets: ["Wrote SQL queries for the monthly close."],
      },
    ],
    requirements: [{ id: "r1", text: "SQL", importance: "must", kind: "skill" }],
    known: [],
    proposed: [
      {
        requirementId: "r1",
        entryRef: null,
        kind: "confirm",
        subject: "SQL",
        topicKey: null,
        question: "Do you have SQL experience?",
        why,
      },
    ],
    kept: [],
  },
  {
    id: "nothing",
    libraryText: [
      "E1 | EXPERIENCE | Line cook",
      "  Served 80 guests during dinner service and cut ticket times by 10 minutes.",
      "  Held a food handler card and followed the HACCP temperature checks.",
      "E2 | EXPERIENCE | Shift lead",
      "  Directed a team of 4 cooks through Friday dinner and closed the kitchen with no leftover waste.",
      "E3 | EXPERIENCE | Trainer",
      "  Trained 6 new hires on the opening checklist and each one passed the food-safety quiz.",
      "SKILLS",
      "  Food handler card",
      "  HACCP",
      "  Kitchen training",
    ].join("\n"),
    postingText:
      "Need a food handler card, HACCP checks, dinner service for about 80 guests, shorter ticket times, a team of cooks, and training new hires.",
    entries: [
      {
        ref: "E1",
        id: "e-cook",
        title: "Line cook",
        bullets: [
          "Served 80 guests during dinner service and cut ticket times by 10 minutes.",
          "Held a food handler card and followed the HACCP temperature checks.",
        ],
      },
      {
        ref: "E2",
        id: "e-lead",
        title: "Shift lead",
        bullets: [
          "Directed a team of 4 cooks through Friday dinner and closed the kitchen with no leftover waste.",
        ],
      },
      {
        ref: "E3",
        id: "e-train",
        title: "Trainer",
        bullets: [
          "Trained 6 new hires on the opening checklist and each one passed the food-safety quiz.",
        ],
      },
    ],
    requirements: [
      { id: "r1", text: "Food handler card", importance: "must", kind: "certification" },
      { id: "r2", text: "Dinner service volume", importance: "must", kind: "experience" },
      { id: "r3", text: "Shorter ticket times", importance: "must", kind: "experience" },
      { id: "r4", text: "Leading a cook team", importance: "nice", kind: "experience" },
      { id: "r5", text: "Training new hires", importance: "nice", kind: "experience" },
    ],
    known: [],
    proposed: [
      {
        requirementId: "r1",
        entryRef: "E1",
        kind: "confirm",
        subject: "food handler card",
        topicKey: null,
        question: "Do you hold a food handler card?",
        why,
      },
      {
        requirementId: "r2",
        entryRef: "E1",
        kind: "scale",
        subject: "dinner service",
        topicKey: null,
        question: "Did you serve 80 guests during dinner service and cut ticket times by 10 minutes?",
        why,
      },
      {
        requirementId: "r3",
        entryRef: "E1",
        kind: "outcome",
        subject: "ticket times",
        topicKey: null,
        question: "What changed in ticket times after you served 80 guests during dinner service?",
        why,
      },
      {
        requirementId: "r4",
        entryRef: "E2",
        kind: "detail",
        subject: "cook team",
        topicKey: null,
        question: "Did you direct a team of 4 cooks through Friday dinner and close the kitchen?",
        why,
      },
      {
        requirementId: "r5",
        entryRef: "E3",
        kind: "detail",
        subject: "new hires",
        topicKey: null,
        question: "Did you train 6 new hires on the opening checklist and each one passed the food-safety quiz?",
        why,
      },
    ],
    kept: [],
  },
  {
    id: "prior-no",
    libraryText: "E1 | EXPERIENCE | RoleRefine\n  Handled Stripe webhooks for payments.",
    postingText: "Stripe webhooks and on-call support.",
    entries: [
      {
        ref: "E1",
        id: "e-prior",
        title: "RoleRefine",
        bullets: ["Handled Stripe webhooks for payments."],
      },
    ],
    requirements: [
      { id: "r1", text: "Stripe webhooks", importance: "must", kind: "experience" },
      { id: "r2", text: "On-call support", importance: "nice", kind: "experience" },
    ],
    known: [{ subject: "Stripe webhooks", entryId: "e-prior" }],
    proposed: [
      {
        requirementId: "r1",
        entryRef: "E1",
        kind: "detail",
        subject: "Stripe webhooks",
        topicKey: null,
        question: "In RoleRefine, how did the Stripe webhooks decide a payment was done?",
        why,
      },
      {
        requirementId: "r2",
        entryRef: "E1",
        kind: "confirm",
        subject: "on-call rotation",
        topicKey: null,
        question: "Did you join an on-call rotation for this role?",
        why,
      },
    ],
    kept: ["Did you join an on-call rotation for this role?"],
  },
  {
    id: "presuppose",
    libraryText: "E1 | EXPERIENCE | RoleRefine\n  Handled Stripe webhooks for payments.",
    postingText: "Stripe webhooks.",
    entries: [
      {
        ref: "E1",
        id: "e-pre",
        title: "RoleRefine",
        bullets: ["Handled Stripe webhooks for payments."],
      },
    ],
    requirements: [{ id: "r1", text: "Stripe webhooks", importance: "must", kind: "experience" }],
    known: [],
    proposed: [
      {
        requirementId: "r1",
        entryRef: "E1",
        kind: "confirm",
        subject: "webhook checks",
        topicKey: null,
        question: "You verified Stripe webhooks, didn't you?",
        why,
      },
      {
        requirementId: "r1",
        entryRef: "E1",
        kind: "detail",
        subject: "webhook failure",
        topicKey: null,
        question: "What did a failed Stripe webhook do in this role?",
        why,
      },
    ],
    kept: ["What did a failed Stripe webhook do in this role?"],
  },
  {
    id: "unstated-tool",
    libraryText: "E1 | EXPERIENCE | Analyst\n  Wrote Python scripts for the monthly file.",
    postingText: "Python scripts. Kubernetes is listed on the posting.",
    entries: [
      {
        ref: "E1",
        id: "e-tool",
        title: "Analyst",
        bullets: ["Wrote Python scripts for the monthly file."],
      },
    ],
    requirements: [
      { id: "r1", text: "Python scripts", importance: "must", kind: "skill" },
      { id: "r2", text: "Kubernetes", importance: "nice", kind: "skill" },
    ],
    known: [],
    proposed: [
      {
        requirementId: "r2",
        entryRef: "E1",
        kind: "detail",
        subject: "deploys",
        topicKey: null,
        question: "Did you use Kubernetes to deploy those scripts?",
        why,
      },
      {
        requirementId: "r1",
        entryRef: "E1",
        kind: "detail",
        subject: "python scripts",
        topicKey: null,
        question: "How were the Python scripts started?",
        why,
      },
    ],
    kept: ["How were the Python scripts started?"],
  },
  {
    id: "same-topic",
    libraryText: "E1 | EXPERIENCE | RoleRefine\n  Maintained the booking site.",
    postingText: "REST API design and RESTful APIs are required.",
    entries: [
      {
        ref: "E1",
        id: "e-same",
        title: "RoleRefine",
        bullets: ["Maintained the booking site."],
      },
    ],
    requirements: [{ id: "r1", text: "REST API design", importance: "must", kind: "experience" }],
    known: [],
    proposed: [
      {
        requirementId: "r1",
        entryRef: "E1",
        kind: "confirm",
        subject: "REST API design",
        topicKey: null,
        question: "Did you work on REST API design for the booking site?",
        why,
      },
      {
        requirementId: "r1",
        entryRef: "E1",
        kind: "confirm",
        subject: "RESTful APIs",
        topicKey: null,
        question: "Did you work on RESTful APIs for the booking site?",
        why,
      },
    ],
    kept: ["Did you work on REST API design for the booking site?"],
  },
  {
    id: "role",
    libraryText:
      "E1 | EXPERIENCE | RoleRefine\n  Shipped the booking site with Cursor and a coding agent.",
    postingText: "The booking site and the API routes.",
    entries: [
      {
        ref: "E1",
        id: "e-role",
        title: "RoleRefine",
        bullets: ["Shipped the booking site with Cursor and a coding agent."],
      },
    ],
    requirements: [{ id: "r1", text: "Booking site", importance: "must", kind: "experience" }],
    known: [],
    proposed: [
      {
        requirementId: "r1",
        entryRef: "E1",
        kind: "confirm",
        subject: "personal build",
        topicKey: null,
        question: "You built the booking site yourself, right?",
        why,
      },
      {
        requirementId: "r1",
        entryRef: "E1",
        kind: "role",
        subject: "personal contribution",
        topicKey: null,
        question: "What did you personally write, direct, review, or test on the booking site?",
        why,
      },
    ],
    kept: ["What did you personally write, direct, review, or test on the booking site?"],
    drafts: [
      {
        answer: "I reviewed the generated routes.",
        text: "Built the booking API.",
        allow: false,
      },
      {
        answer: "I reviewed the generated routes.",
        text: "Reviewed generated routes for the booking site.",
        allow: true,
      },
    ],
  },
];
