import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // drizzle-kit push/migrate only; the app itself reads DATABASE_URL in src/db/index.ts
    url: process.env.DATABASE_URL!,
  },
});