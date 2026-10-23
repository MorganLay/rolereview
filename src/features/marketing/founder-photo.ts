import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";

/** Public path. The file is optional; the homepage falls back to the initial. */
export const FOUNDER_PHOTO_SRC = "/founder.jpg";

export function founderPhotoReady(): boolean {
  return existsSync(path.join(process.cwd(), "public", "founder.jpg"));
}
