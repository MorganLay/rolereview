/**
 * Prints why a saved resume kept or left each entry.
 * Reads the stored plan and composer notes. It does not call the model.
 *
 * npx tsx --conditions=react-server scripts/explain-resume.ts
 * npx tsx --conditions=react-server scripts/explain-resume.ts <resumeId>
 */
import "dotenv/config";

import { JobAnalysis } from "@/features/jobs/schemas";
import { LibrarySnapshot } from "@/features/library/schemas";
import { explainResumeDecisions } from "@/features/tailor/explain";
import { ResumeContent, ValidatedTailorOutput } from "@/features/tailor/schemas";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function main() {
  const userId = env.SEED_USER_ID?.trim() ?? "";
  if (!UUID.test(userId)) {
    throw new Error("Set SEED_USER_ID in .env to your Supabase user id.");
  }
  const requested = process.argv.find((arg) => UUID.test(arg));
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new Error("No User row for SEED_USER_ID.");

  const resume = await db.tailoredResume.findFirst({
    where: {
      userId: user.id,
      ...(requested ? { id: requested } : { status: "READY" }),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      version: true,
      content: true,
      aiOutput: true,
      librarySnapshot: true,
      job: { select: { title: true, company: true, analysis: true } },
    },
  });
  if (!resume?.content || !resume.librarySnapshot) {
    throw new Error(requested ? "That resume was not found." : "No ready resume was found.");
  }
  const content = ResumeContent.safeParse(resume.content);
  const snapshot = LibrarySnapshot.safeParse(resume.librarySnapshot);
  if (!content.success || !snapshot.success) {
    throw new Error("The saved resume could not be read.");
  }
  const analysis = JobAnalysis.safeParse(resume.job.analysis);
  const output = ValidatedTailorOutput.safeParse(resume.aiOutput);
  console.log(`resume ${resume.id} version ${resume.version}`);
  console.log(
    explainResumeDecisions({
      content: content.data,
      snapshot: snapshot.data,
      title: analysis.success ? analysis.data.title : resume.job.title,
      company: analysis.success ? analysis.data.company : resume.job.company,
      requirements: analysis.success ? analysis.data.requirements : [],
      matches: output.success ? output.data.requirementMatches : [],
    }),
  );
}

const invokedDirectly = process.argv.some((arg) => arg.includes("explain-resume.ts"));
if (invokedDirectly) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Explanation failed.";
    console.error(message);
    process.exitCode = 1;
  });
}
