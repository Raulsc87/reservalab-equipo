import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eval: vi.fn()
}));

vi.mock("../src/db/redis.js", () => ({
  redis: mocks
}));

import {
  consumeApiKeyRequest
} from "../src/services/rate-limit.service.js";

beforeEach(() => {
  vi.resetAllMocks();
});

it.each([
  [1, true, 59],
  [60, true, 0],
  [61, false, 0]
])(
  "procesa la solicitud número %s",
  async (count, allowed, remaining) => {
    mocks.eval.mockResolvedValue([count, 45]);

    await expect(
      consumeApiKeyRequest("key-prueba")
    ).resolves.toEqual({
      allowed,
      limit: 60,
      remaining,
      retryAfter: 45
    });

    expect(mocks.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      "reservalab:rate:key-prueba"
    );
  }
);

it("devuelve al menos un segundo de espera", async () => {
  mocks.eval.mockResolvedValue([61, 0]);

  const result = await consumeApiKeyRequest("key-prueba");

  expect(result.retryAfter).toBe(1);
});

it.each([
  null,
  [1],
  ["incorrecto", 60],
  [1, "incorrecto"]
])("rechaza respuestas inválidas de Redis: %j", async (value) => {
  mocks.eval.mockResolvedValue(value);

  await expect(
    consumeApiKeyRequest("key-prueba")
  ).rejects.toThrow();
});

it("propaga una caída de Redis", async () => {
  const error = new Error("Redis desconectado");
  mocks.eval.mockRejectedValue(error);

  await expect(
    consumeApiKeyRequest("key-prueba")
  ).rejects.toBe(error);
});