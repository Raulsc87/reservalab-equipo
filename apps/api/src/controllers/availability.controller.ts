import type { Request, Response } from "express";
import {
  availabilityQuerySchema,
  spaceIdSchema
} from "@reservalab/shared";
import {
  cachedQuery
} from "../services/cache.service.js";
import {
  getSpaceAvailability
} from "../services/availability.service.js";
import {
  SpaceNotFoundError
} from "../services/spaces.service.js";

export async function availability(
  req: Request,
  res: Response
): Promise<void> {
  const idResult = spaceIdSchema.safeParse(req.params.id);

  if (!idResult.success) {
    res.status(400).json({
      error: "Identificador de espacio invalido"
    });
    return;
  }

  const queryResult = availabilityQuerySchema.safeParse(
    req.query
  );

  if (!queryResult.success) {
    res.status(400).json({
      error: "Debes enviar una fecha valida con formato YYYY-MM-DD",
      details: queryResult.error.issues
    });
    return;
  }

  try {
  const response = await cachedQuery(
  `availability:${idResult.data}:${queryResult.data.date}`,
  () => getSpaceAvailability(
    idResult.data,
    queryResult.data.date
  )
);

res.set("X-Cache", response.cache);
res.status(200).json(response.data);
  } catch (error) {
    if (error instanceof SpaceNotFoundError) {
      res.status(404).json({
        error: error.message
      });
      return;
    }

    res.status(500).json({
      error: "No se pudo consultar la disponibilidad"
    });
  }
}