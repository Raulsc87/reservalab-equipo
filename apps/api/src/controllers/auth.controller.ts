import type { Request, Response } from "express";
import { registerSchema, loginSchema } from "@reservalab/shared";
import {
  registerUser,
  loginUser
} from "../services/auth.service.js";

export async function register(
  req: Request,
  res: Response
): Promise<void> {
  const result = registerSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      error: "Datos invalidos",
      details: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      }))
    });
    return;
  }

  if (Buffer.byteLength(result.data.password, "utf8") > 72) {
    res.status(400).json({
      error: "La contraseña no puede superar 72 bytes"
    });
    return;
  }

  try {
    const user = await registerUser(result.data);

    res.status(201).json({
      message: "Usuario registrado correctamente",
      user
    });
  } catch (error) {
    const databaseError =
      error instanceof Error && error.cause
        ? error.cause
        : error;

    if (
      typeof databaseError === "object" &&
      databaseError !== null &&
      "code" in databaseError &&
      databaseError.code === "23505" &&
      "constraint" in databaseError &&
      databaseError.constraint === "users_email_unique"
    ) {
      res.status(409).json({
        error: "Este correo ya esta registrado"
      });
      return;
    }

    res.status(500).json({
      error: "No se pudo completar el registro"
    });
  }
}

export async function login(
  req: Request,
  res: Response
): Promise<void> {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      error: "Correo o contraseña con formato invalido"
    });
    return;
  }

  try {
    const session = await loginUser(result.data);

    if (!session) {
      res.status(401).json({
        error: "Correo o contraseña incorrectos"
      });
      return;
    }

    res.status(200).json({
      message: "Inicio de sesion correcto",
      ...session
    });
  } catch {
    res.status(500).json({
      error: "No se pudo completar el inicio de sesion"
    });
  }
  
}
export function getMe(_req: Request, res: Response): void {
  res.status(200).json({
    user: res.locals.user
  });
}