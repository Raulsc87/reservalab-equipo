import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

config({
  path: resolve(process.cwd(), "../../.env"),
  quiet: true
});

const user = process.env.POSTGRES_USER;
const database = process.env.POSTGRES_DB;
const password = process.env.POSTGRES_PASSWORD;

if (!user || !database || !password) {
  throw new Error("Faltan las variables de PostgreSQL en .env");
}

const host = process.env.POSTGRES_HOST ?? "127.0.0.1";
const port = process.env.POSTGRES_PORT ?? "5433";

const url = new URL("postgresql://localhost");
url.hostname = host;
url.port = port;
url.username = user;
url.password = password;
url.pathname = `/${database}`;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: url.toString()
  }
});