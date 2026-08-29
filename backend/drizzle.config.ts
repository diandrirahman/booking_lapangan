import { defineConfig } from "drizzle-kit";
import { loadEnvironment } from "./src/config/environment.js";

const environment = loadEnvironment();

export default defineConfig({
  dialect: "mysql",
  schema: "./src/database/schema/index.ts",
  out: "./drizzle-v2",
  dbCredentials: {
    url: environment.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
