import { ImageResponse } from "next/og";

import { strings } from "@/copy/strings";

/** Brand tokens — keep in sync with docs/10-BRAND.md (ImageResponse can't use Tailwind). */
const colors = {
  paper: "#FAF8F4",
  ink: "#142033",
  slate: "#566273",
  pine: "#1F6B57",
} as const;

export const ogSize = { width: 1200, height: 630 } as const;

let sourceSerifPromise: Promise<ArrayBuffer> | null = null;

function loadSourceSerif(): Promise<ArrayBuffer> {
  if (!sourceSerifPromise) {
    sourceSerifPromise = fetch(
      "https://cdn.jsdelivr.net/fontsource/fonts/source-serif-4@5.2.8/latin-600-normal.ttf",
    ).then(async (res) => {
      if (!res.ok) {
        throw new Error(`Failed to load Source Serif 4 (${res.status})`);
      }
      return res.arrayBuffer();
    });
  }
  return sourceSerifPromise;
}

type BrandOgOptions = {
  /** Page title under the wordmark. Defaults to the brand name. */
  title?: string;
  /** Subline under the pine rule. Defaults to the brand tagline. */
  tagline?: string;
};

/**
 * Shared OG template: paper background, wordmark, title, pine rule, tagline.
 * Spec: docs/10-BRAND.md → Email & social.
 */
export async function brandOgImage({
  title = strings.brand.name,
  tagline = strings.brand.tagline,
}: BrandOgOptions = {}): Promise<ImageResponse> {
  const fontData = await loadSourceSerif();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: colors.paper,
          padding: "64px 72px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 36,
              fontWeight: 600,
              color: colors.ink,
              letterSpacing: "-0.02em",
            }}
          >
            {strings.brand.name}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 64,
              fontWeight: 600,
              color: colors.ink,
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              maxWidth: 980,
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              width: 96,
              height: 4,
              backgroundColor: colors.pine,
              borderRadius: 2,
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: colors.slate,
            maxWidth: 900,
            lineHeight: 1.4,
          }}
        >
          {tagline}
        </div>
      </div>
    ),
    {
      ...ogSize,
      fonts: [
        {
          name: "Source Serif 4",
          data: fontData,
          style: "normal",
          weight: 600,
        },
      ],
    },
  );
}
