// Prisma 7 config. Migrations use DIRECT_URL (session/direct, port 5432).
// Runtime client uses pooled DATABASE_URL via @prisma/adapter-pg in src/lib/db.ts.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DIRECT_URL"],
  },
});
