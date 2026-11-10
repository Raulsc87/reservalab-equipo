import type { Request, Response } from "express";
import { refreshSchema } from "@reservalab/shared";
import {
  renewSession,
  endSession
} from "../services/sessions.service.js";

export async function refresh(
  req: Request,
  res: Response
): Promise<void> {
  const result = refreshSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      error: "Debes enviar un refreshToken con formato valido"
    });
    return;
  }

  try {
    const session = await renewSession(result.data.refreshToken);

    if (!session) {
      res.status(401).json({
        error: "Refresh token invalido, vencido o revocado"
      });
      return;
    }

    res.set("Cache-Control", "no-store");
    res.status(200).json({
      message: "Sesion renovada correctamente",
      ...session
    });
  } catch {
    res.status(500).json({
      error: "No se pudo renovar la sesion"
    });
  }
}

export async function logout(
  req: Request,
  res: Response
): Promise<void> {
  const result = refreshSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      error: "Debes enviar un refreshToken con formato valido"
    });
    return;
  }

  try {
    await endSession(result.data.refreshToken);
    res.status(204).send();
  } catch {
    res.status(500).json({
      error: "No se pudo cerrar la sesion"
    });
  }
}