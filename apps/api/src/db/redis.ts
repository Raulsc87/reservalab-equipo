import { Redis } from "ioredis";
import { config } from "dotenv";
import { resolve } from "node:path";

config({
  path: resolve(process.cwd(), "../../.env"),
  quiet: true
});

export const redis = new Redis(
  process.env.REDIS_URL ?? "redis://127.0.0.1:6380",
  {
    connectTimeout: 2000,
    commandTimeout: 2000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy(times) {
      return Math.min(times * 500, 3000);
    }
  }
);

redis.on("error", (error: Error) => {
  console.error("Redis no disponible:", error.message);
});