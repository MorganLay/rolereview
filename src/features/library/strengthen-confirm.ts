/**
 * Turns confirmed discovery answers into evidence the draft guard can trust.
 * A "yes" is a fact. The person's detail is authoritative. Follow-up rounds
 * must keep earlier confirmations, or elaborations are lost before drafting.
 */

export type StrengthenAnswer = {
  question: string;
  yes: boolean | null;
  detail: string;
};

/**
 * Affirm a confirmed question so the model and the guard see a statement,
 * not an unanswered hypothesis. Detail text is kept verbatim.
 */
export function formatConfirmedAnswer(question: string, detail: string): string {
  const q = question.replace(/\s+/g, " ").trim();
  const d = detail.replace(/\s+/g, " ").trim();
  const affirmed = affirmQuestion(q);
  if (d.length === 0) return affirmed;
  return `${affirmed} Detail: ${d}`;
}

/** Confirmed yes answers from one round, as grounded evidence lines. */
export function confirmedFromAnswers(answers: readonly StrengthenAnswer[]): string[] {
  return answers
    .filter((answer) => answer.yes === true)
    .map((answer) => formatConfirmedAnswer(answer.question, answer.detail))
    .filter((line) => line.length > 0);
}

/**
 * Merge a new round onto prior confirmations. Later answers for the same
 * question replace the earlier line; otherwise new lines are appended.
 */
export function mergeConfirmed(
  prior: readonly string[],
  next: readonly string[],
): string[] {
  const byKey = new Map<string, string>();
  for (const line of prior) {
    const key = confirmKey(line);
    if (key) byKey.set(key, line);
  }
  for (const line of next) {
    const key = confirmKey(line);
    if (key) byKey.set(key, line);
    else byKey.set(line.toLowerCase(), line);
  }
  return [...byKey.values()].slice(0, 12);
}

function affirmQuestion(question: string): string {
  let text = question.replace(/\?+$/g, "").trim();
  if (text.length === 0) return "Confirmed.";

  text = text.replace(/^beyond\b[^,]*,\s*/i, "");
  text = text.replace(
    /^(did|do|have|had|were|was|are|is|can|could|would)\s+you\s+/i,
    "",
  );
  text = text.replace(/^(did|do|does)\s+/i, "");

  const statement = capitalize(text);
  return statement.endsWith(".") ? `Confirmed: ${statement}` : `Confirmed: ${statement}.`;
}

function confirmKey(line: string): string | null {
  const match = /^Confirmed:\s*(.+?)(?:\s+Detail:|$)/i.exec(line);
  const body = match?.[1]?.trim().toLowerCase().replace(/\.+$/g, "");
  return body && body.length > 0 ? body : null;
}

function capitalize(value: string): string {
  if (value.length === 0) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
