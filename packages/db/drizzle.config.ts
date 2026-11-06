import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    // .env の DATABASE_URL(generate では使われない)
    url: process.env.DATABASE_URL ?? "",
  },
});
