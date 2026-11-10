import {
  createHash,
  randomBytes
} from "node:crypto";
import type {
  CreateApiKeyInput
} from "@reservalab/shared";
import type {
  ApiKeyPermission
} from "@reservalab/shared";
import {
  findValidApiKeyByHash,
  markApiKeyUsed
} from "../repositories/api-keys.repository.js";
import {
  consumeApiKeyRequest
} from "./rate-limit.service.js";
import {
  insertApiKey,
  listApiKeys,
  revokeApiKeyById
} from "../repositories/api-keys.repository.js";



export class ApiKeyNotFoundError extends Error {
  constructor() {
    super("API key no encontrada");
    this.name = "ApiKeyNotFoundError";
  }
}

export async function createApiKey(
  userId: string,
  data: CreateApiKeyInput
) {
  const key = `rl_live_${randomBytes(32).toString("hex")}`;

  const keyHash = createHash("sha256")
    .update(key)
    .digest("hex");

  const prefix = key.slice(0, 16);

  const apiKey = await insertApiKey(
    userId,
    data,
    keyHash,
    prefix
  );

  // La clave completa solo se devuelve en esta operación.
  return {
    key,
    apiKey
  };
}

export async function getApiKeys() {
  return listApiKeys();
}

export async function revokeApiKey(id: string): Promise<void> {
  const apiKey = await revokeApiKeyById(id);

  if (!apiKey) {
    throw new ApiKeyNotFoundError();
  }
}

export class ApiKeyAccessError extends Error {
  constructor(
    public readonly reason: "invalid" | "permission" | "limit",
    message: string,
    public readonly retryAfter: number = 0
  ) {
    super(message);
    this.name = "ApiKeyAccessError";
  }
}

export async function authenticateApiKey(
  key: string,
  permission: ApiKeyPermission
) {
  if (!/^rl_live_[a-f0-9]{64}$/.test(key)) {
    throw new ApiKeyAccessError(
      "invalid",
      "API key invalida"
    );
  }

  const keyHash = createHash("sha256")
    .update(key)
    .digest("hex");

  const apiKey = await findValidApiKeyByHash(keyHash);

  if (!apiKey) {
    throw new ApiKeyAccessError(
      "invalid",
      "API key invalida, vencida o revocada"
    );
  }

  const rate = await consumeApiKeyRequest(apiKey.id);

  if (!rate.allowed) {
    throw new ApiKeyAccessError(
      "limit",
      "Limite de solicitudes alcanzado",
      rate.retryAfter
    );
  }

  if (!apiKey.permissions.includes(permission)) {
    throw new ApiKeyAccessError(
      "permission",
      "La API key no tiene el permiso requerido"
    );
  }

  const updated = await markApiKeyUsed(apiKey.id);

  if (!updated) {
    throw new ApiKeyAccessError(
      "invalid",
      "API key invalida, vencida o revocada"
    );
  }

  return {
    apiKey,
    rate
  };
}