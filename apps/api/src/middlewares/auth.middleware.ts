import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/tokens.service.js";
import { findUserById } from "../repositories/users.repository.js";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authorization = req.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);

  if (!match) {
    res.status(401).json({
      error: "Debes enviar un token Bearer"
    });
    return;
  }

  let identity: ReturnType<typeof verifyAccessToken>;

  try {
    identity = verifyAccessToken(match[1]);
  } catch {
    res.status(401).json({
      error: "Token invalido o vencido"
    });
    return;
  }

  const user = await findUserById(identity.id);

  if (!user || !user.active) {
    res.status(401).json({
      error: "Usuario no disponible"
    });
    return;
  }

  res.locals.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };

  next();
}