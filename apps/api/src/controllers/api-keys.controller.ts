import type { Request, Response } from "express";
import {
  createApiKeySchema,
  apiKeyIdSchema
} from "@reservalab/shared";
import {
  createApiKey,
  getApiKeys,
  revokeApiKey,
  ApiKeyNotFoundError
} from "../services/api-keys.service.js";

function handleError(error: unknown, res: Response): void {
  if (error instanceof ApiKeyNotFoundError) {
    res.status(404).json({
      error: error.message
    });
    return;
  }

  console.error("Error en API keys:", error);

  res.status(500).json({
    error: "No se pudo completar la operacion"
  });
}

export async function create(
  req: Request,
  res: Response
): Promise<void> {
  res.set("Cache-Control", "no-store");

  const result = createApiKeySchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      error: "Datos de API key invalidos",
      details: result.error.issues
    });
    return;
  }

  try {
    const resultKey = await createApiKey(
      res.locals.user.id,
      result.data
    );

    res.status(201).json({
      message: "Guarda esta clave: solo se muestra una vez",
      ...resultKey
    });
  } catch (error) {
    handleError(error, res);
  }
}

export async function list(
  _req: Request,
  res: Response
): Promise<void> {
  res.set("Cache-Control", "no-store");

  try {
    const apiKeys = await getApiKeys();

    res.status(200).json({
      apiKeys
    });
  } catch (error) {
    handleError(error, res);
  }
}

export async function remove(
  req: Request,
  res: Response
): Promise<void> {
  const result = apiKeyIdSchema.safeParse(req.params.id);

  if (!result.success) {
    res.status(400).json({
      error: "Identificador de API key invalido"
    });
    return;
  }

  try {
    await revokeApiKey(result.data);

    res.status(204).send();
  } catch (error) {
    handleError(error, res);
  }
}