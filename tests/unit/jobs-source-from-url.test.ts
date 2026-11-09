import { describe, expect, it } from "vitest";

import { sourceFromPostingUrl } from "@/features/jobs/source-from-url";

describe("sourceFromPostingUrl", () => {
  it("reads LinkedIn and Indeed from the label after www", () => {
    expect(
      sourceFromPostingUrl(
        "https://www.linkedin.com/jobs/search-results/?currentJobId=4487910308",
      ),
    ).toBe("LINKEDIN");
    expect(sourceFromPostingUrl("https://www.indeed.com/viewjob?jk=abc")).toBe("INDEED");
    expect(sourceFromPostingUrl("https://www.Indeed.ca/jobs")).toBe("INDEED");
  });

  it("reads the same sites when the host has no www", () => {
    expect(sourceFromPostingUrl("https://ca.linkedin.com/jobs/view/123")).toBe("LINKEDIN");
    expect(sourceFromPostingUrl("www.indeed.com/jobs")).toBe("INDEED");
  });

  it("leaves other hosts alone", () => {
    expect(sourceFromPostingUrl("")).toBeNull();
    expect(sourceFromPostingUrl("https://www.example.com/jobs")).toBeNull();
    expect(sourceFromPostingUrl("not a url")).toBeNull();
    expect(sourceFromPostingUrl("https://www.notlinkedin.com/jobs")).toBeNull();
  });
});
