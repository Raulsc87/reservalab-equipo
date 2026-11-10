import {
  and,
  desc,
  eq,
  gt,
  isNull,
  or
} from "drizzle-orm";
import type {
  CreateApiKeyInput
} from "@reservalab/shared";
import { db } from "../db/client.js";
import { apiKeys, users } from "../db/schema.js";


// Estos campos pueden devolverse al cliente.
// El hash queda fuera de las respuestas.
const publicFields = {
  id: apiKeys.id,
  userId: apiKeys.userId,
  name: apiKeys.name,
  prefix: apiKeys.prefix,
  permissions: apiKeys.permissions,
  lastUsedAt: apiKeys.lastUsedAt,
  expiresAt: apiKeys.expiresAt,
  revokedAt: apiKeys.revokedAt,
  createdAt: apiKeys.createdAt
};

export async function insertApiKey(
  userId: string,
  data: CreateApiKeyInput,
  keyHash: string,
  prefix: string
) {
  const [apiKey] = await db
    .insert(apiKeys)
    .values({
      userId,
      name: data.name,
      permissions: [...new Set(data.permissions)],
      expiresAt: data.expiresAt
        ? new Date(data.expiresAt)
        : null,
      keyHash,
      prefix
    })
    .returning(publicFields);

  if (!apiKey) {
    throw new Error("No se pudo guardar la API key");
  }

  return apiKey;
}

export async function listApiKeys() {
  return db
    .select(publicFields)
    .from(apiKeys)
    .orderBy(desc(apiKeys.createdAt));
}

export async function revokeApiKeyById(id: string) {
  const [apiKey] = await db
    .update(apiKeys)
    .set({
      revokedAt: new Date()
    })
    .where(eq(apiKeys.id, id))
    .returning({ id: apiKeys.id });

  return apiKey;
}

export async function findValidApiKeyByHash(keyHash: string) {
  const [apiKey] = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      permissions: apiKeys.permissions
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(
      and(
        eq(apiKeys.keyHash, keyHash),
        isNull(apiKeys.revokedAt),
        eq(users.active, true),
        or(
          isNull(apiKeys.expiresAt),
          gt(apiKeys.expiresAt, new Date())
        )
      )
    )
    .limit(1);

  return apiKey;
}

export async function markApiKeyUsed(id: string) {
  const now = new Date();

  const [apiKey] = await db
    .update(apiKeys)
    .set({ lastUsedAt: now })
    .where(
      and(
        eq(apiKeys.id, id),
        isNull(apiKeys.revokedAt),
        or(
          isNull(apiKeys.expiresAt),
          gt(apiKeys.expiresAt, now)
        )
      )
    )
    .returning({ id: apiKeys.id });

  return apiKey;
}