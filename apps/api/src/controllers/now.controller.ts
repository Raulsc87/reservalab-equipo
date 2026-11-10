import type { Request, Response } from "express";
import { nowQuerySchema } from "@reservalab/shared";
import { getNow } from "../services/now.service.js";
import {
  cachedQuery
} from "../services/cache.service.js";

export async function listNow(
  req: Request,
  res: Response
): Promise<void> {
  const result = nowQuerySchema.safeParse(req.query);

  if (!result.success) {
    res.status(400).json({
      error: "Filtros de ocupacion invalidos",
      details: result.error.issues
    });
    return;
  }

  try {
    const response = await cachedQuery(
  `now:${JSON.stringify(result.data)}`,
  () => getNow(result.data)
);

res.set("X-Cache", response.cache);
res.status(200).json(response.data);
  } catch (error) {
    console.error("Error al consultar ocupacion:", error);

    res.status(500).json({
      error: "No se pudo consultar la ocupacion actual"
    });
  }
}