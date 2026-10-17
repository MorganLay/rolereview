import { brandOgImage, ogSize } from "@/lib/og/brand-image";
import { strings } from "@/copy/strings";

export const alt = `${strings.brand.name} — ${strings.brand.tagline}`;
export const size = ogSize;
export const contentType = "image/png";

export default async function OpenGraphImage() {
  return brandOgImage({
    title: strings.brand.name,
    tagline: strings.brand.tagline,
  });
}
