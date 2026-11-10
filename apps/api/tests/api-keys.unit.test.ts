import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insertApiKey: vi.fn(),
  listApiKeys: vi.fn(),
  revokeApiKeyById: vi.fn(),
  findValidApiKeyByHash: vi.fn(),
  markApiKeyUsed: vi.fn(),
  consumeApiKeyRequest: vi.fn()
}));

vi.mock("../src/repositories/api-keys.repository.js", () => ({
  insertApiKey: mocks.insertApiKey,
  listApiKeys: mocks.listApiKeys,
  revokeApiKeyById: mocks.revokeApiKeyById,
  findValidApiKeyByHash: mocks.findValidApiKeyByHash,
  markApiKeyUsed: mocks.markApiKeyUsed
}));

vi.mock("../src/services/rate-limit.service.js", () => ({
  consumeApiKeyRequest: mocks.consumeApiKeyRequest
}));

import {
  createApiKey,
  getApiKeys,
  revokeApiKey,
  authenticateApiKey,
  ApiKeyNotFoundError
} from "../src/services/api-keys.service.js";

const key = `rl_live_${"a".repeat(64)}`;

const metadata = {
  id: "key-prueba",
  name: "Pantalla",
  permissions: ["read:now"]
};

const rate = {
  allowed: true,
  limit: 60,
  remaining: 59,
  retryAfter: 60
};

beforeEach(() => {
  vi.resetAllMocks();

  mocks.insertApiKey.mockResolvedValue(metadata);
  mocks.listApiKeys.mockResolvedValue([metadata]);
  mocks.revokeApiKeyById.mockResolvedValue(metadata);
  mocks.findValidApiKeyByHash.mockResolvedValue(metadata);
  mocks.markApiKeyUsed.mockResolvedValue(metadata);
  mocks.consumeApiKeyRequest.mockResolvedValue(rate);
});

it("genera una clave aleatoria y entrega solo su hash al repositorio", async () => {
  const input = {
    name: "Pantalla",
    permissions: ["read:now"] as Array<"read:now">
  };

  const first = await createApiKey("admin", input);
  const second = await createApiKey("admin", input);

  expect(first.key).toMatch(/^rl_live_[a-f0-9]{64}$/);
  expect(second.key).not.toBe(first.key);

  const expectedHash = createHash("sha256")
    .update(first.key)
    .digest("hex");

  expect(mocks.insertApiKey).toHaveBeenNthCalledWith(
    1,
    "admin",
    input,
    expectedHash,
    first.key.slice(0, 16)
  );

  expect(first.apiKey).toEqual(metadata);
});

it("lista los metadatos de las claves", async () => {
  await expect(getApiKeys()).resolves.toEqual([metadata]);
});

it("revoca una clave existente", async () => {
  await revokeApiKey(metadata.id);

  expect(mocks.revokeApiKeyById).toHaveBeenCalledWith(
    metadata.id
  );
});

it("rechaza revocar una clave inexistente", async () => {
  mocks.revokeApiKeyById.mockResolvedValue(undefined);

  await expect(
    revokeApiKey("inexistente")
  ).rejects.toBeInstanceOf(ApiKeyNotFoundError);
});

it("autentica mediante hash y registra su último uso", async () => {
  const result = await authenticateApiKey(key, "read:now");

  expect(mocks.findValidApiKeyByHash).toHaveBeenCalledWith(
    createHash("sha256").update(key).digest("hex")
  );

  expect(mocks.markApiKeyUsed).toHaveBeenCalledWith(metadata.id);
  expect(result).toEqual({ apiKey: metadata, rate });
});

it("rechaza un formato incorrecto antes de consultar la base", async () => {
  await expect(
    authenticateApiKey("clave-invalida", "read:now")
  ).rejects.toMatchObject({ reason: "invalid" });

  expect(mocks.findValidApiKeyByHash).not.toHaveBeenCalled();
});

it("rechaza una clave que el repositorio no considera válida", async () => {
  mocks.findValidApiKeyByHash.mockResolvedValue(undefined);

  await expect(
    authenticateApiKey(key, "read:now")
  ).rejects.toMatchObject({ reason: "invalid" });

  expect(mocks.consumeApiKeyRequest).not.toHaveBeenCalled();
});

it("rechaza solicitudes cuando se agota el límite", async () => {
  mocks.consumeApiKeyRequest.mockResolvedValue({
    ...rate,
    allowed: false,
    remaining: 0,
    retryAfter: 25
  });

  await expect(
    authenticateApiKey(key, "read:now")
  ).rejects.toMatchObject({
    reason: "limit",
    retryAfter: 25
  });

  expect(mocks.markApiKeyUsed).not.toHaveBeenCalled();
});

it("rechaza una clave sin el permiso solicitado", async () => {
  await expect(
    authenticateApiKey(key, "read:spaces")
  ).rejects.toMatchObject({ reason: "permission" });

  expect(mocks.markApiKeyUsed).not.toHaveBeenCalled();
});

it("rechaza una clave revocada durante la autenticación", async () => {
  mocks.markApiKeyUsed.mockResolvedValue(undefined);

  await expect(
    authenticateApiKey(key, "read:now")
  ).rejects.toMatchObject({ reason: "invalid" });
});