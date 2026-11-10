import type { HealthResponse } from "@reservalab/shared";
import {
  checkDatabase,
  checkCache
} from "../repositories/health.repository.js";

export async function getHealthStatus(): Promise<HealthResponse> {
  const [databaseResult, cacheResult] = await Promise.allSettled([
    checkDatabase(),
    checkCache()
  ]);

  const database = databaseResult.status === "fulfilled"
    ? "up"
    : "down";

  const cache = cacheResult.status === "fulfilled"
    ? "up"
    : "down";

  return {
    status: database === "up" && cache === "up"
      ? "ok"
      : "error",
    service: "reservalab-api",
    database,
    cache
  };
}