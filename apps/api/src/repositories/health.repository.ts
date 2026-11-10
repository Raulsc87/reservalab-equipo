import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { redis } from "../db/redis.js";

export async function checkDatabase(): Promise<void> {
  await db.execute(sql`SELECT 1`);
}

export async function checkCache(): Promise<void> {
  const response = await redis.ping();

  if (response !== "PONG") {
    throw new Error("Respuesta inesperada de Redis");
  }
}