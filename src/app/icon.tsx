import { ImageResponse } from "next/og";

/** Favicon: "R" in Paper on a Pine rounded square — docs/10-BRAND.md. */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1F6B57",
          borderRadius: 8,
          color: "#FAF8F4",
          fontSize: 20,
          fontWeight: 700,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          letterSpacing: "-0.04em",
        }}
      >
        R
      </div>
    ),
    { ...size },
  );
}
