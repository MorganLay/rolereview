import { strings } from "@/copy/strings";
import { brandOgImage, ogSize } from "@/lib/og/brand-image";

const title = strings.marketing.terms.metaTitle;

export const alt = `${title} — ${strings.brand.tagline}`;
export const size = ogSize;
export const contentType = "image/png";

export default function TwitterImage() {
  return brandOgImage({
    title,
    tagline: strings.brand.tagline,
  });
}
