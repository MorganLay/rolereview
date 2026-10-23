import type { MetadataRoute } from "next";

import { robotsDocument } from "@/features/marketing/seo";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return robotsDocument(env.NEXT_PUBLIC_APP_URL);
}
