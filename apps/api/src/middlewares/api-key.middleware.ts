import type { RequestHandler } from "express";
import type {
  ApiKeyPermission
} from "@reservalab/shared";
import {
  authenticateApiKey,
  ApiKeyAccessError
} from "../services/api-keys.service.js";
import { requireAuth } from "./auth.middleware.js";

export function requireApiKey(
  permission: ApiKeyPermission
): RequestHandler {
  return async (req, res, next): Promise<void> => {
    const key = req.get("x-api-key");

    if (!key) {
      res.status(401).json({
        error: "Debes enviar una API key en X-API-Key"
      });
      return;
    }

    try {
      const result = await authenticateApiKey(
        key,
        permission
      );

      res.locals.apiKey = result.apiKey;

      res.set(
        "X-RateLimit-Limit",
        String(result.rate.limit)
      );

      res.set(
        "X-RateLimit-Remaining",
        String(result.rate.remaining)
      );

      next();
    } catch (error) {
      if (error instanceof ApiKeyAccessError) {
        if (error.reason === "limit") {
          res.set("Retry-After", String(error.retryAfter));

          res.status(429).json({
            error: error.message
          });
          return;
        }

        res.status(
          error.reason === "permission" ? 403 : 401
        ).json({
          error: error.message
        });
        return;
      }

      console.error("Error al validar API key:", error);

      res.status(503).json({
        error: "No se pudo validar la API key en este momento"
      });
    }
  };
}

export function requireUserOrApiKey(
  permission: ApiKeyPermission
): RequestHandler {
  const apiKeyMiddleware = requireApiKey(permission);

  return async (req, res, next): Promise<void> => {
    if (req.get("x-api-key") !== undefined) {
      await apiKeyMiddleware(req, res, next);
      return;
    }

    await requireAuth(req, res, next);
  };
}