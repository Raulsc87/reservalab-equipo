import type { RequestHandler } from "express";
import type { Role } from "@reservalab/shared";

export function requireRoles(...allowedRoles: Role[]): RequestHandler {
  return (_req, res, next): void => {
    const user = res.locals.user;

    if (!user) {
      res.status(401).json({
        error: "Debes iniciar sesion"
      });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        error: "No tienes permisos para realizar esta accion"
      });
      return;
    }

    next();
  };
}