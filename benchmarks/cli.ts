/**
 * Benchmark commands. They do not call a model unless --send is present,
 * and this file never passes --send by itself.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { estimateThreeArm, MODEL_LED_SMOKE } from "./model-led/cost";
import { estimateExperiment } from "./write-verify/estimate";
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

const parsed = parseArgs(process.argv.slice(2));
const commands: Record<string, (args: Args) => number | Promise<number>> = {
  validate,
  "dry-run": dryRun,
  report,
  execute,
  "model-led": modelLed,
  "write-verify": writeVerify,
};
const run = commands[parsed.command];
if (!run) {
  console.error("Use validate, dry-run, report, execute, model-led, or write-verify.");
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
