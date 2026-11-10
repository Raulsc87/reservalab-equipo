import { config } from "dotenv";
import { resolve } from "node:path";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

config({
  path: resolve(process.cwd(), "../../.env"),
  quiet: true
});

const { Pool } = pg;

if (
  !process.env.POSTGRES_USER ||
  !process.env.POSTGRES_DB ||
  !process.env.POSTGRES_PASSWORD
) {
  throw new Error(
    "Faltan las variables de PostgreSQL en el archivo .env"
  );
}

export const pool = new Pool({
  host: process.env.POSTGRES_HOST ?? "127.0.0.1",
  port: Number(process.env.POSTGRES_PORT ?? "5433"),
  user: process.env.POSTGRES_USER,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  connectionTimeoutMillis: 5000
});

export const db = drizzle({ client: pool });