import type { Request, Response } from "express";
import {
  createReservationSchema,
  reservationIdSchema
} from "@reservalab/shared";
import {
  createReservation,
  getMyReservations,
  cancelReservation,
  InvalidReservationError,
  ReservationConflictError,
  ReservationNotFoundError,
  ReservationForbiddenError
} from "../services/reservations.service.js";
import {
  SpaceNotFoundError
} from "../services/spaces.service.js";

function handleError(error: unknown, res: Response): void {
  if (error instanceof InvalidReservationError) {
    res.status(400).json({ error: error.message });
    return;
  }

  if (error instanceof ReservationForbiddenError) {
    res.status(403).json({ error: error.message });
    return;
  }

  if (
    error instanceof ReservationNotFoundError ||
    error instanceof SpaceNotFoundError
  ) {
    res.status(404).json({ error: error.message });
    return;
  }

  if (error instanceof ReservationConflictError) {
    res.status(409).json({ error: error.message });
    return;
  }

  console.error("Error en reservas:", error);

  res.status(500).json({
    error: "No se pudo completar la operacion"
  });
}

export async function create(
  req: Request,
  res: Response
): Promise<void> {
  const result = createReservationSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      error: "Datos de reserva invalidos",
      details: result.error.issues
    });
    return;
  }

  try {
    const reservation = await createReservation(
      res.locals.user.id,
      result.data
    );

    res.status(201).json({
      message: "Reserva creada correctamente",
      reservation
    });
  } catch (error) {
    handleError(error, res);
  }
}

export async function listMine(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const reservations = await getMyReservations(
      res.locals.user.id
    );

    res.status(200).json({ reservations });
  } catch (error) {
    handleError(error, res);
  }
}

export async function remove(
  req: Request,
  res: Response
): Promise<void> {
  const result = reservationIdSchema.safeParse(req.params.id);

  if (!result.success) {
    res.status(400).json({
      error: "Identificador de reserva invalido"
    });
    return;
  }

  try {
    await cancelReservation(
      result.data,
      res.locals.user.id,
      res.locals.user.role
    );

    res.status(204).send();
  } catch (error) {
    handleError(error, res);
  }
}