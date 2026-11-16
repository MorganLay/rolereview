/**
 * Benchmark commands. They do not call a model unless --send is present,
 * and this file never passes --send by itself.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { estimateThreeArm, MODEL_LED_SMOKE } from "./model-led/cost";
import { estimateExperiment, estimateW2, estimateW21, estimateW3, estimateW4, estimateW5 } from "./write-verify/estimate";
import { estimateCalibration } from "./write-verify/w3-calibrate";
import { careerLibraryInput } from "./model-led/library";
import { authorizeSpend, estimateCase, estimateRun } from "./lib/cost";
import { candidateIds, equalEvidenceInput, loadCase, loadCases, loadSmokeIds } from "./lib/load";
import { caseReport, overallReport } from "./lib/report";
import { adaptFixtureResume } from "./lib/snapshot";
import { validateFixtures } from "./lib/validate";

type Args = {
  command: string;
  id: string | null;
  ids: string[];
  suite: "smoke" | "full" | "case" | "sample";
  confirmSpend: boolean;
  maxUsd: number | null;
  send: boolean;
};

function parseArgs(argv: string[]): Args {
  const command = argv[0] ?? "validate";
  const ids: string[] = [];
  let suite: Args["suite"] = command === "execute" ? "case" : "full";
  let confirmSpend = false;
  let maxUsd: number | null = null;
  let send = false;
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--confirm-spend") confirmSpend = true;
    else if (token === "--send") send = true;
    else if (token === "--id") {
      const value = argv[++index];
      if (value) ids.push(value);
    } else if (token === "--suite") {
      const value = argv[++index];
      if (value === "smoke" || value === "full" || value === "case" || value === "sample") suite = value;
    } else if (token === "--max-usd") {
      maxUsd = Number(argv[++index]);
    }
  }
  return { command, id: ids[0] ?? null, ids, suite, confirmSpend, maxUsd, send };
}

function selectedIds(args: Args): string[] {
  if (args.ids.length > 0) return args.ids;
  if (args.suite === "sample") return ["P005-J013", "P004-J011", "P001-J012"];
  if (args.suite === "smoke") return loadSmokeIds();
  return loadCases().map((item) => item.id);
}

function validate(): number {
  const issues = validateFixtures();
  if (issues.length === 0) {
    console.log(`Fixtures valid. ${loadCases().length} cases, ${loadSmokeIds().length} smoke cases.`);
    return 0;
  }
  for (const issue of issues) console.error(`${issue.code}: ${issue.detail}`);
  return 1;
}

function dryRun(args: Args): number {
  const ids = selectedIds(args);
  const estimate = estimateCase();
  console.log("Dry run. No model request will be sent.");
  for (const line of estimate.lines) console.log(`- ${line.name}: $${line.usd.toFixed(4)}`);
  console.log(estimate.note);
  console.log(`Cases: ${ids.length}. Estimated worst case: $${estimateRun(ids.length).toFixed(2)}.`);
  return 0;
}

function report(args: Args): number {
  const sourced = candidateIds().filter((id) => id.startsWith("P")).length;
  const synthetic = candidateIds().filter((id) => id.startsWith("S")).length;
  console.log(overallReport({ caseCount: loadCases().length, sourcedCandidates: sourced, syntheticCandidates: synthetic }));
  if (args.id) {
    const testCase = loadCase(args.id);
    if (!testCase) {
      console.error(`Unknown case ${args.id}.`);
      return 1;
    }
    console.log("\n");
    console.log(caseReport(testCase, "not-run"));
  }
  return 0;
}

async function execute(args: Args): Promise<number> {
  const ids = selectedIds(args);
  if (args.suite === "case" && args.ids.length === 0) {
    console.error("Name a case with --id.");
    return 1;
  }
  const unknown = ids.filter((id) => !loadCase(id));
  if (unknown.length > 0) {
    console.error(`Unknown case ${unknown[0]}.`);
    return 1;
  }
  const estimatedUsd = estimateRun(ids.length);
  const gate = authorizeSpend({
    confirmSpend: args.confirmSpend,
    maxUsd: args.maxUsd,
    estimatedUsd,
  });
  if (!gate.ok) {
    console.error(gate.reason);
    return 1;
  }
  if (args.send) {
    const { runPaidCases } = await import("./lib/paid");
    await runPaidCases({ caseIds: ids, maxUsd: gate.maxUsd });
    return 0;
  }
  const runId = `planned-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const directory = path.join(process.cwd(), "benchmarks", "results", runId);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, "plan.json"),
    JSON.stringify(
      {
        runId,
        status: "authorized-not-sent",
        caseIds: ids,
        estimatedUsd,
        maxUsd: gate.maxUsd,
        note: "No provider request was sent. Results from this file are not evaluation outcomes.",
      },
      null,
      2,
    ),
  );
  console.log(`Authorized plan written to benchmarks/results/${runId}/plan.json. No request was sent.`);
  return 0;
}

function modelLed(args: Args): number | Promise<number> {
  const ids = args.ids.length > 0 ? args.ids : [...MODEL_LED_SMOKE];
  const unknown = ids.filter((id) => !loadCase(id));
  if (unknown.length > 0) {
    console.error(`Unknown case ${unknown[0]}.`);
    return 1;
  }
  const estimate = estimateThreeArm(ids.length);
  console.log("Three-arm planning estimate. No request is sent unless --send is set.");
  for (const line of estimate.lines) console.log(`- ${line.name}: $${line.usd.toFixed(4)}`);
  console.log(estimate.note);
  console.log(
    `Cases: ${ids.length}. One pass $${estimate.runOnePassUsd.toFixed(2)}. Worst case $${estimate.runWorstUsd.toFixed(2)}.`,
  );
  for (const id of ids) {
    const testCase = loadCase(id);
    if (!testCase) continue;
    const evidence = equalEvidenceInput(testCase);
    const library = careerLibraryInput(adaptFixtureResume(evidence.resume).snapshot);
    console.log(
      `${id}: ${library.report.entries} entries, ${library.report.bullets} bullets, ${library.report.skills} skills, ~${library.report.approximateTokens} tokens. ${library.report.fitsBudget ? "Fits." : library.report.note}`,
    );
  }
  console.log(
    `Arm C alone, which is what --send runs: one pass $${estimate.armCOnePassUsd.toFixed(2)}, worst case $${estimate.armCWorstUsd.toFixed(2)}.`,
  );
  const gate = authorizeSpend({
    confirmSpend: args.confirmSpend,
    maxUsd: args.maxUsd,
    estimatedUsd: estimate.armCWorstUsd,
  });
  if (!args.send) {
    console.log("Dry run. Pass --confirm-spend --max-usd and --send to run arm C. Arms A and B use execute with the same ids.");
    return 0;
  }
  if (!gate.ok) {
    console.error(gate.reason);
    return 1;
  }
  return import("./model-led/execute").then(({ runModelLedCases }) =>
    runModelLedCases({ caseIds: ids, maxUsd: gate.maxUsd }).then(() => 0),
  );
}

function writeVerify(args: Args): number | Promise<number> {
  const estimate = estimateExperiment();
  console.log("Write-then-verify planning estimate. No request is sent unless --send is set.");
  for (const line of estimate.lines) {
    console.log(`- ${line.id}: ~${line.inputTokens} input tokens. O $${line.armOUsd.toFixed(4)}. W $${line.armWUsd.toFixed(4)}.`);
  }
  console.log(estimate.note);
  console.log(
    `Arm O $${estimate.armOUsd.toFixed(2)}. Arm W $${estimate.armWUsd.toFixed(2)}. Fix calls, worst case $${estimate.fixWorstUsd.toFixed(2)}. Worst case $${estimate.worstUsd.toFixed(2)}.`,
  );
  const gate = authorizeSpend({
    confirmSpend: args.confirmSpend,
    maxUsd: args.maxUsd,
    estimatedUsd: estimate.worstUsd,
  });
  if (!args.send) {
    console.log("Dry run. Pass --confirm-spend --max-usd and --send to run both arms. No request was sent.");
    return 0;
  }
  if (!gate.ok) {
    console.error(gate.reason);
    return 1;
  }
  return import("./write-verify/execute").then(({ runExperiment }) =>
    runExperiment({ maxUsd: gate.maxUsd }).then(() => 0),
  );
}

function writeVerifyW2(args: Args): number | Promise<number> {
  const estimate = estimateW2();
  console.log("W2 planning estimate. No request is sent unless --send is set.");
  console.log(
    `Drafts $${estimate.draftUsd.toFixed(2)}. Coverage $${estimate.coverageUsd.toFixed(2)}. Fixes $${estimate.fixUsd.toFixed(2)}. Worst case $${estimate.worstUsd.toFixed(2)}.`,
  );
  console.log(estimate.note);
  if (estimate.worstUsd > 0.75) {
    console.error(`Worst case $${estimate.worstUsd.toFixed(2)} is over the $0.75 cap. No request was sent.`);
    return 1;
  }
  const gate = authorizeSpend({
    confirmSpend: args.confirmSpend,
    maxUsd: args.maxUsd,
    estimatedUsd: estimate.worstUsd,
  });
  if (!args.send) {
    console.log("Dry run. Pass --confirm-spend --max-usd 0.75 and --send to run W2. No request was sent.");
    return 0;
  }
  if (!gate.ok) {
    console.error(gate.reason);
    return 1;
  }
  return import("./write-verify/w2-run").then(({ runW2 }) => runW2({ maxUsd: gate.maxUsd }).then(() => 0));
}

function writeVerifyW21(args: Args): number | Promise<number> {
  const estimate = estimateW21();
  console.log("W2.1 planning estimate. No request is sent unless --send is set.");
  console.log(
    `Drafts $${estimate.draftUsd.toFixed(2)}. Coverage $${estimate.coverageUsd.toFixed(2)}. Fixes $${estimate.fixUsd.toFixed(2)}. Cuts $${estimate.cutUsd.toFixed(2)}. Imports $${estimate.importUsd.toFixed(2)}. Worst case $${estimate.worstUsd.toFixed(2)}.`,
  );
  console.log(estimate.note);
  const worstCents = Math.round(estimate.worstUsd * 100) / 100;
  if (worstCents > 1) {
    console.error(`Worst case $${worstCents.toFixed(2)} is over the $1.00 cap. No request was sent.`);
    return 1;
  }
  console.log(`Unrounded planning sum $${estimate.worstUsd.toFixed(4)}. The run stops before a call that could pass $1.00.`);
  const gate = authorizeSpend({
    confirmSpend: args.confirmSpend,
    maxUsd: args.maxUsd,
    estimatedUsd: worstCents,
  });
  if (!args.send) {
    console.log("Dry run. Pass --confirm-spend --max-usd 1.00 and --send to run W2.1. No request was sent.");
    return 0;
  }
  if (!gate.ok) {
    console.error(gate.reason);
    return 1;
  }
  return import("./write-verify/w21-run").then(({ runW21 }) => runW21({ maxUsd: gate.maxUsd }).then(() => 0));
}

function writeVerifyW3Arm(args: Args): number | Promise<number> {
  const estimate = estimateW3();
  console.log("W3 planning estimate. No request is sent unless --send is set.");
  console.log(
    `Imports $${estimate.importUsd.toFixed(2)}. W3 $${estimate.w3Usd.toFixed(2)}. Production $${estimate.productionUsd.toFixed(2)}. Unconstrained worst $${estimate.worstUsd.toFixed(2)}.`,
  );
  console.log(estimate.note);
  const gate = authorizeSpend({
    confirmSpend: args.confirmSpend,
    maxUsd: args.maxUsd,
    estimatedUsd: Math.min(estimate.worstUsd, args.maxUsd ?? estimate.worstUsd),
  });
  if (!args.send) {
    console.log("Dry run. Pass --confirm-spend --max-usd 2.00 and --send to run W3. No request was sent.");
    return 0;
  }
  if (!gate.ok) {
    console.error(gate.reason);
    return 1;
  }
  return import("./write-verify/w3-run").then(({ runW3 }) => runW3({ maxUsd: gate.maxUsd }).then(() => 0));
}

function writeVerifyW4Arm(args: Args): number | Promise<number> {
  const estimate = estimateW4();
  console.log("W4 planning estimate. No request is sent unless --send is set.");
  console.log(
    `Prompt test $${estimate.promptUsd.toFixed(2)}. Repair $${estimate.repairUsd.toFixed(2)}. W4 $${estimate.w4Usd.toFixed(2)}. Unconstrained worst $${estimate.worstUsd.toFixed(2)}.`,
  );
  console.log(estimate.note);
  const gate = authorizeSpend({
    confirmSpend: args.confirmSpend,
    maxUsd: args.maxUsd,
    estimatedUsd: Math.min(estimate.worstUsd, args.maxUsd ?? estimate.worstUsd),
  });
  if (!args.send) {
    console.log("Dry run. Pass --confirm-spend --max-usd 1.25 and --send to run W4. No request was sent.");
    return 0;
  }
  if (!gate.ok) {
    console.error(gate.reason);
    return 1;
  }
  return import("./write-verify/w4-run").then(({ runW4 }) => runW4({ maxUsd: gate.maxUsd }).then(() => 0));
}

function writeVerifyW5Arm(args: Args): number | Promise<number> {
  const estimate = estimateW5();
  console.log("W5 planning estimate. No request is sent unless --send is set.");
  console.log(
    `Repair $${estimate.repairUsd.toFixed(2)}. W5 $${estimate.w5Usd.toFixed(2)}. Unconstrained worst $${estimate.worstUsd.toFixed(2)}.`,
  );
  console.log(estimate.note);
  const gate = authorizeSpend({
    confirmSpend: args.confirmSpend,
    maxUsd: args.maxUsd,
    estimatedUsd: Math.min(estimate.worstUsd, args.maxUsd ?? estimate.worstUsd),
  });
  if (!args.send) {
    console.log("Dry run. Pass --confirm-spend --max-usd 1.00 and --send to run W5. No request was sent.");
    return 0;
  }
  if (!gate.ok) {
    console.error(gate.reason);
    return 1;
  }
  return import("./write-verify/w5-run").then(({ runW5 }) => runW5({ maxUsd: gate.maxUsd }).then(() => 0));
}

function writeVerifyW3(args: Args): number | Promise<number> {
  const estimate = estimateCalibration();
  console.log("W3 calibration estimate. The verifier only. No drafts and no fixes. No request is sent unless --send is set.");
  console.log(`Worst case $${estimate.usd.toFixed(2)} for 20 checks. Output cap ${1200} tokens each.`);
  if (estimate.usd > 0.6) {
    console.error(`Worst case $${estimate.usd.toFixed(2)} is over the $0.60 cap. No request was sent.`);
    return 1;
  }
  const gate = authorizeSpend({
    confirmSpend: args.confirmSpend,
    maxUsd: args.maxUsd,
    estimatedUsd: estimate.usd,
  });
  if (!args.send) {
    console.log("Dry run. Pass --confirm-spend --max-usd 0.60 and --send to calibrate. No request was sent.");
    return 0;
  }
  if (!gate.ok) {
    console.error(gate.reason);
    return 1;
  }
  return import("./write-verify/w3-calibrate").then(({ runCalibration }) =>
    runCalibration({ maxUsd: gate.maxUsd }).then(() => 0),
  );
}

const parsed = parseArgs(process.argv.slice(2));
const commands: Record<string, (args: Args) => number | Promise<number>> = {
  validate,
  "dry-run": dryRun,
  report,
  execute,
  "model-led": modelLed,
  "write-verify": writeVerify,
  w2: writeVerifyW2,
  w21: writeVerifyW21,
  "w3-arm": writeVerifyW3Arm,
  w3: writeVerifyW3,
  "w4-arm": writeVerifyW4Arm,
  "w5-arm": writeVerifyW5Arm,
};
const run = commands[parsed.command];
if (!run) {
  console.error("Use validate, dry-run, report, execute, model-led, write-verify, w2, w21, w3-arm, w3, w4-arm, or w5-arm.");
  process.exitCode = 1;
} else {
  void Promise.resolve(run(parsed))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Benchmark failed.";
      console.error(message);
      process.exitCode = 1;
    });
}
