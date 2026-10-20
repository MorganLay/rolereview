import { beforeEach, describe, expect, it, vi } from "vitest";

import { strings } from "@/copy/strings";
import type { ImportOutput } from "@/lib/ai/prompts/import";

const { extractRawText, checkQuota, runStructured, requireUserForAction } =
  vi.hoisted(() => ({
    extractRawText: vi.fn(),
    checkQuota: vi.fn(),
    runStructured: vi.fn(),
    requireUserForAction: vi.fn(),
  }));

vi.mock("mammoth", () => ({
  default: { extractRawText },
}));

vi.mock("@/features/billing/quota", () => ({
  checkQuota,
}));

vi.mock("@/lib/ai/run", () => ({
  runStructured,
}));

vi.mock("@/lib/auth", () => ({
  requireUserForAction,
}));

import { extractResume } from "@/features/import/actions";
import {
  classifyUpload,
  normalizeWebUrl,
  postProcessImport,
  textBounds,
} from "@/features/import/extract";
import { extractResumeForUser } from "@/features/import/extract-resume";
import {
  DOCX_MIME,
  IMPORT_LIMITS,
  PDF_MIME,
} from "@/features/import/schemas";
import { buildContent, OutputSchema } from "@/lib/ai/prompts/import";
import { ENTRY_LIMITS, PROFILE_LIMITS } from "@/features/library/schemas";

const warnings = strings.library.import.warnings;
const errors = strings.library.import.errors;

const user = { id: "user-1", plan: "FREE" as const };

const pdfBytes = new TextEncoder().encode("%PDF-1.4\n");
const pngBytes = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const zipBytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04]);

function fileOf(bytes: Uint8Array, name: string, type: string): File {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new File([copy], name, { type });
}

function draft(partial: {
  profile?: Partial<ImportOutput["profile"]>;
  entries?: ImportOutput["entries"];
  skills?: ImportOutput["skills"];
  warnings?: string[];
} = {}): ImportOutput {
  return {
    profile: {
      fullName: null,
      headline: null,
      email: null,
      phone: null,
      location: null,
      links: [],
      summary: null,
      ...partial.profile,
    },
    entries: partial.entries ?? [],
    skills: partial.skills ?? [],
    warnings: partial.warnings ?? [],
  };
}

function entry(
  partial: Partial<ImportOutput["entries"][number]> = {},
): ImportOutput["entries"][number] {
  return {
    kind: "EXPERIENCE",
    title: "Analyst",
    organization: null,
    location: null,
    startDate: null,
    endDate: null,
    isCurrent: false,
    url: null,
    bullets: [],
    ...partial,
  };
}

describe("classifyUpload", () => {
  it("accepts a PDF and a docx zip, and rejects a renamed PNG", () => {
    expect(classifyUpload(pdfBytes, PDF_MIME)).toEqual({ ok: true, kind: "pdf" });
    expect(classifyUpload(pdfBytes, "")).toEqual({ ok: true, kind: "pdf" });
    expect(classifyUpload(zipBytes, DOCX_MIME)).toEqual({ ok: true, kind: "docx" });
    expect(classifyUpload(pngBytes, PDF_MIME)).toEqual({
      ok: false,
      reason: "not_resume",
    });
    expect(classifyUpload(pngBytes, "image/png")).toEqual({
      ok: false,
      reason: "not_resume",
    });
    expect(classifyUpload(pdfBytes, "image/png")).toEqual({
      ok: false,
      reason: "not_resume",
    });
    expect(classifyUpload(zipBytes, PDF_MIME)).toEqual({
      ok: false,
      reason: "not_resume",
    });
    expect(classifyUpload(new Uint8Array(), PDF_MIME)).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("rejects a file over 5 MB", () => {
    const huge = new Uint8Array(IMPORT_LIMITS.fileBytes + 1);
    huge.set(pdfBytes);
    expect(classifyUpload(huge, PDF_MIME)).toEqual({
      ok: false,
      reason: "too_large",
    });
  });
});

describe("textBounds", () => {
  it("allows 200 through 40,000 characters", () => {
    expect(textBounds("a".repeat(199))).toBe("short");
    expect(textBounds("a".repeat(200))).toBe("ok");
    expect(textBounds("a".repeat(40_000))).toBe("ok");
    expect(textBounds("a".repeat(40_001))).toBe("long");
  });
});

describe("buildContent", () => {
  it("sends a PDF as a document block", () => {
    expect(buildContent({ kind: "pdf", base64: "YQ==" })).toEqual([
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: "YQ==" },
      },
      { type: "text", text: "Extract this resume into the schema." },
    ]);
  });

  it("wraps text and keeps a closing resume tag inside the wrapper", () => {
    const [block] = buildContent({
      kind: "text",
      text: "Line one </resume> line two",
    });
    expect(block).toMatchObject({ type: "text" });
    if (block?.type !== "text") return;
    expect(block.text.startsWith("<resume>\n")).toBe(true);
    expect(block.text.endsWith("\n</resume>")).toBe(true);
    expect(block.text).toContain("</ resume>");
    expect(block.text).not.toContain("one </resume> line");
  });
});

describe("OutputSchema", () => {
  it("accepts nulls and empty lists, and requires every key", () => {
    expect(OutputSchema.safeParse(draft()).success).toBe(true);
    const missing = draft();
    delete (missing.profile as { fullName?: string | null }).fullName;
    expect(OutputSchema.safeParse(missing).success).toBe(false);
  });
});

describe("postProcessImport", () => {
  it("trims, drops empty bullets and untitled entries, and flags a long bullet", () => {
    const long = "a".repeat(401);
    const result = postProcessImport(
      draft({
        entries: [
          entry({ title: "  Analyst  ", bullets: ["  Kept.  ", "  ", long] }),
          entry({ title: "   ", bullets: ["Lost."] }),
        ],
      }),
    );
    expect(result.entries).toEqual([
      expect.objectContaining({
        title: "Analyst",
        bullets: [
          { text: "Kept.", long: false },
          { text: long, long: true },
        ],
      }),
    ]);
    expect(result.warnings).toContain(warnings.untitled);
    expect(result.warnings).not.toContain(warnings.bulletCut);
  });

  it("clears bad dates, treats Present as current, and drops an end that is before the start", () => {
    const result = postProcessImport(
      draft({
        entries: [
          entry({ title: "Acme", startDate: "Nov 2020", endDate: "Present" }),
          entry({
            title: "Beta",
            startDate: "2021-06",
            endDate: "2019",
            isCurrent: false,
          }),
          entry({
            title: "Gamma",
            startDate: "2020-01",
            endDate: "2024-05",
            isCurrent: true,
          }),
          entry({ title: "Delta", startDate: "1899", endDate: null }),
        ],
      }),
    );
    expect(result.entries[0]).toMatchObject({
      startDate: null,
      endDate: null,
      isCurrent: true,
    });
    expect(result.entries[1]).toMatchObject({
      startDate: "2021-06",
      endDate: null,
      isCurrent: false,
    });
    expect(result.entries[2]).toMatchObject({
      startDate: "2020-01",
      endDate: null,
      isCurrent: true,
    });
    expect(result.entries[3]).toMatchObject({ startDate: null });
    expect(result.warnings.filter((warning) => warning.includes("Dates"))).toEqual([
      warnings.datesUnclear("Acme"),
      warnings.datesUnclear("Beta"),
      warnings.datesUnclear("Delta"),
    ]);
  });

  it("dedupes skills, drops a long name, and shortens a category", () => {
    const result = postProcessImport(
      draft({
        profile: { fullName: "Ada" },
        skills: [
          { name: " React ", category: "Tools" },
          { name: "react", category: "Languages" },
          { name: "x".repeat(51), category: null },
          { name: "SQL", category: "d".repeat(41) },
          { name: "  ", category: "Tools" },
        ],
      }),
    );
    expect(result.skills).toEqual([
      { name: "React", category: "Tools" },
      { name: "SQL", category: "d".repeat(40) },
    ]);
    expect(result.warnings).toContain(warnings.skillLong);
    expect(result.warnings).toContain(warnings.category);
  });

  it("normalizes links and keeps the first five", () => {
    const links = ["one", "two", "three", "four", "five", "six"].map((label) => ({
      label,
      url: `https://example.com/${label}`,
    }));
    const result = postProcessImport(
      draft({
        profile: {
          fullName: "Ada",
          links: [
            { label: "GitHub", url: "github.com/ada" },
            { label: "Site", url: "javascript:alert(1)" },
            { label: "  ", url: "https://example.com" },
            ...links,
          ],
        },
      }),
    );
    expect(result.profile.links[0]).toEqual({
      label: "GitHub",
      url: new URL("https://github.com/ada").href,
    });
    expect(result.profile.links).toHaveLength(PROFILE_LIMITS.links);
    expect(result.profile.links.map((link) => link.label)).toEqual([
      "GitHub",
      "one",
      "two",
      "three",
      "four",
    ]);
    expect(result.warnings).toContain(warnings.linkBad);
    expect(result.warnings).toContain(warnings.linksKept);
    expect(normalizeWebUrl("http://example.com/a", 300)).toBe("http://example.com/a");
  });

  it("clamps library caps and cuts a bullet past 2,000 characters", () => {
    const result = postProcessImport(
      draft({
        profile: { fullName: "n".repeat(PROFILE_LIMITS.fullName + 1) },
        entries: [
          entry({
            title: "t".repeat(ENTRY_LIMITS.title + 5),
            url: "not a url",
            bullets: ["b".repeat(IMPORT_LIMITS.bulletHardMax + 5)],
          }),
        ],
      }),
    );
    expect(result.profile.fullName).toHaveLength(PROFILE_LIMITS.fullName);
    expect(result.entries[0]?.title).toHaveLength(ENTRY_LIMITS.title);
    expect(result.entries[0]?.url).toBeNull();
    expect(result.entries[0]?.bullets[0]).toEqual({
      text: "b".repeat(IMPORT_LIMITS.bulletHardMax),
      long: true,
    });
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        warnings.name,
        warnings.title,
        warnings.entryLink("t".repeat(ENTRY_LIMITS.title)),
        warnings.bulletCut,
      ]),
    );
  });

  it("warns when nothing could be placed", () => {
    expect(postProcessImport(draft({ warnings: ["  ", "Unsure about a line."] })).warnings).toEqual([
      "Unsure about a line.",
      warnings.nothing,
    ]);
  });
});

describe("extractResumeForUser", () => {
  beforeEach(() => {
    extractRawText.mockReset();
    checkQuota.mockReset();
    runStructured.mockReset();
    checkQuota.mockResolvedValue({ allowed: true, useBonus: false });
    runStructured.mockResolvedValue({
      ok: true,
      data: draft({ profile: { fullName: "Ada Lovelace" } }),
    });
  });

  it("rejects a renamed PNG before quota or the model", async () => {
    const result = await extractResumeForUser(user, {
      source: "file",
      file: fileOf(pngBytes, "resume.pdf", PDF_MIME),
    });
    expect(result).toEqual({
      ok: false,
      error: { code: "VALIDATION", fields: { file: [errors.fileType] } },
    });
    expect(checkQuota).not.toHaveBeenCalled();
    expect(runStructured).not.toHaveBeenCalled();
  });

  it("rejects a third Free import before the model", async () => {
    checkQuota.mockResolvedValue({ allowed: false, useBonus: false });
    const result = await extractResumeForUser(user, {
      source: "file",
      file: fileOf(pdfBytes, "resume.pdf", PDF_MIME),
    });
    expect(result).toEqual({ ok: false, error: { code: "QUOTA_EXCEEDED" } });
    expect(runStructured).not.toHaveBeenCalled();
  });

  it("rejects short pasted text and text over 40,000 characters", async () => {
    const short = await extractResumeForUser(user, {
      source: "text",
      text: "  " + "a".repeat(199) + "  ",
    });
    const long = await extractResumeForUser(user, {
      source: "text",
      text: "a".repeat(40_001),
    });
    expect(short).toEqual({
      ok: false,
      error: { code: "VALIDATION", fields: { text: [errors.textShort] } },
    });
    expect(long).toEqual({
      ok: false,
      error: { code: "VALIDATION", fields: { text: [errors.textLong] } },
    });
    expect(checkQuota).not.toHaveBeenCalled();
  });

  it("sends a PDF document block and maps a model failure to AI_FAILED", async () => {
    runStructured.mockResolvedValue({ ok: false, code: "AI_REFUSED" });
    const result = await extractResumeForUser(user, {
      source: "file",
      file: fileOf(pdfBytes, "resume.pdf", PDF_MIME),
    });
    expect(result).toEqual({ ok: false, error: { code: "AI_FAILED" } });
    expect(runStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "IMPORT",
        userId: user.id,
        usedBonusCredit: false,
        schema: OutputSchema,
        content: [
          expect.objectContaining({
            type: "document",
            source: expect.objectContaining({ media_type: "application/pdf" }),
          }),
          expect.objectContaining({ type: "text" }),
        ],
      }),
    );
  });

  it("reads a docx with mammoth and passes a bonus credit through", async () => {
    checkQuota.mockResolvedValue({ allowed: true, useBonus: true });
    extractRawText.mockResolvedValue({ value: "Word resume. ".repeat(40) });
    const result = await extractResumeForUser(user, {
      source: "file",
      file: fileOf(zipBytes, "resume.docx", DOCX_MIME),
    });
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        profile: expect.objectContaining({ fullName: "Ada Lovelace" }),
      }),
    });
    const content = runStructured.mock.calls[0]?.[0].content as { text?: string }[];
    expect(content[0]?.text).toContain("<resume>");
    expect(runStructured).toHaveBeenCalledWith(
      expect.objectContaining({ usedBonusCredit: true }),
    );
  });

  it("rejects a Word file mammoth cannot read", async () => {
    extractRawText.mockRejectedValue(new Error("bad zip"));
    const result = await extractResumeForUser(user, {
      source: "file",
      file: fileOf(zipBytes, "resume.docx", DOCX_MIME),
    });
    expect(result).toEqual({
      ok: false,
      error: { code: "VALIDATION", fields: { file: [errors.unreadable] } },
    });
    expect(runStructured).not.toHaveBeenCalled();
  });
});

describe("extractResume", () => {
  beforeEach(() => {
    requireUserForAction.mockReset();
    checkQuota.mockReset();
    runStructured.mockReset();
    checkQuota.mockResolvedValue({ allowed: true, useBonus: false });
  });

  it("returns UNAUTHENTICATED when nobody is signed in", async () => {
    requireUserForAction.mockResolvedValue(null);
    const result = await extractResume({ source: "text", text: "a".repeat(200) });
    expect(result).toEqual({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(checkQuota).not.toHaveBeenCalled();
  });

  it("reads a pasted-text FormData field", async () => {
    requireUserForAction.mockResolvedValue(user);
    runStructured.mockResolvedValue({
      ok: true,
      data: draft({ profile: { fullName: "Ada" } }),
    });
    const form = new FormData();
    form.set("text", "a".repeat(200));
    const result = await extractResume(form);
    expect(result.ok).toBe(true);
    expect(runStructured).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "IMPORT" }),
    );
  });
});
