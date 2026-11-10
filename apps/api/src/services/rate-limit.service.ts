import { redis } from "../db/redis.js";

export const API_KEY_REQUEST_LIMIT = 60;

// Incrementar y asignar vencimiento se ejecuta como una
// operación atómica para soportar solicitudes simultáneas.
const counterScript = `
local count = redis.call("INCR", KEYS[1])
local ttl = redis.call("TTL", KEYS[1])

if ttl < 0 then
  redis.call("EXPIRE", KEYS[1], 60)
  ttl = 60
end

return {count, ttl}
`;

export async function consumeApiKeyRequest(apiKeyId: string) {
  const result = await redis.eval(
    counterScript,
    1,
    `reservalab:rate:${apiKeyId}`
  );

  if (!Array.isArray(result) || result.length !== 2) {
    throw new Error("Respuesta de Redis invalida");
  }

  const count = Number(result[0]);
  const retryAfter = Math.max(1, Number(result[1]));

  if (
    !Number.isFinite(count) ||
    !Number.isFinite(retryAfter)
  ) {
    throw new Error("Contador de solicitudes invalido");
  }

  return {
    allowed: count <= API_KEY_REQUEST_LIMIT,
    limit: API_KEY_REQUEST_LIMIT,
    remaining: Math.max(0, API_KEY_REQUEST_LIMIT - count),
    retryAfter
  };
}