import { createHash, randomUUID } from "node:crypto";
import { redis } from "../db/redis.js";

const REVISION_KEY = "reservalab:cache:revision";
const CACHE_TTL_SECONDS = 60;

interface CacheResult<T> {
  data: T;
  cache: "HIT" | "MISS";
}

async function getRevision(): Promise<string> {
  return (await redis.get(REVISION_KEY)) ?? "0";
}

export async function cachedQuery<T>(
  resource: string,
  load: () => Promise<T>
): Promise<CacheResult<T>> {
  const resourceHash = createHash("sha256")
    .update(resource)
    .digest("hex");

  for (let attempt = 0; attempt < 2; attempt++) {
    const revision = await getRevision();

    const key =
      `reservalab:cache:data:${revision}:${resourceHash}`;

    const stored = await redis.get(key);

    if (stored !== null) {
      if ((await getRevision()) !== revision) {
        continue;
      }

      return {
        data: JSON.parse(stored) as T,
        cache: "HIT"
      };
    }

    const data = await load();

    // Si cambiaron los datos durante la consulta,
    // consultamos nuevamente.
    if ((await getRevision()) !== revision) {
      continue;
    }

    await redis.set(
      key,
      JSON.stringify(data),
      "EX",
      CACHE_TTL_SECONDS
    );

    return {
      data,
      cache: "MISS"
    };
  }

  return {
    data: await load(),
    cache: "MISS"
  };
}

export async function invalidateCache(): Promise<void> {
  // Las siguientes consultas usarán una nueva versión.
  // Las entradas anteriores vencen automáticamente.
  await redis.set(REVISION_KEY, randomUUID());
}