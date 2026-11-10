import type {
  CreateReservationInput,
  Role
} from "@reservalab/shared";
import {
  findReservationById,
  listReservationsByUser,
  findReservationOverlap,
  insertReservation,
  cancelReservationById
} from "../repositories/reservations.repository.js";
import { getSpace } from "./spaces.service.js";
import { invalidateCache } from "./cache.service.js";
import { notifyReservation } from "./notifications.service.js";

export class InvalidReservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReservationError";
  }
}

export class ReservationConflictError extends Error {
  constructor() {
    super("El espacio ya tiene una reserva en ese horario");
    this.name = "ReservationConflictError";
  }
}

export class ReservationNotFoundError extends Error {
  constructor() {
    super("Reserva no encontrada");
    this.name = "ReservationNotFoundError";
  }
}

export class ReservationForbiddenError extends Error {
  constructor() {
    super("No puedes cancelar la reserva de otro usuario");
    this.name = "ReservationForbiddenError";
  }
}

function isOverlapConstraintError(error: unknown): boolean {
  const visited = new Set<unknown>();
  let current = error;

  while (
    current !== null &&
    typeof current === "object" &&
    !visited.has(current)
  ) {
    visited.add(current);

    const dbError = current as {
      code?: string;
      constraint?: string;
      cause?: unknown;
    };

    if (
      dbError.code === "23P01" &&
      dbError.constraint === "reservations_no_overlap"
    ) {
      return true;
    }

    current = dbError.cause;
  }

  return false;
}

export async function createReservation(
  userId: string,
  data: CreateReservationInput
) {
  const startsAt = new Date(data.startsAt);
  const endsAt = new Date(data.endsAt);

  if (
    !Number.isFinite(startsAt.getTime()) ||
    !Number.isFinite(endsAt.getTime()) ||
    endsAt <= startsAt
  ) {
    throw new InvalidReservationError(
      "Debes enviar un periodo valido"
    );
  }

  if (startsAt.getTime() <= Date.now()) {
    throw new InvalidReservationError(
      "La reserva debe comenzar en el futuro"
    );
  }

  const space = await getSpace(data.spaceId);

  // Convertimos el inicio a la fecha local de Guatemala.
  const localDate = new Date(
    startsAt.getTime() - 6 * 60 * 60 * 1000
  ).toISOString().slice(0, 10);

  const opening = new Date(
    `${localDate}T${space.opensAt}-06:00`
  );

  const closing = new Date(
    `${localDate}T${space.closesAt}-06:00`
  );

  if (startsAt < opening || endsAt > closing) {
    throw new InvalidReservationError(
      "La reserva debe estar dentro del horario del espacio"
    );
  }

  const overlap = await findReservationOverlap(
    data.spaceId,
    startsAt,
    endsAt
  );

  if (overlap) {
    throw new ReservationConflictError();
  }

  try {
    const reservation = await insertReservation(
      userId,
      data
    );

    await invalidateCache();

    await notifyReservation(
      "reservation.confirmed",
      reservation
    );

    return reservation;
  } catch (error) {
    // PostgreSQL protege contra reservas simultaneas.
    if (isOverlapConstraintError(error)) {
      throw new ReservationConflictError();
    }

    throw error;
  }
}

export async function getMyReservations(userId: string) {
  return listReservationsByUser(userId);
}

export async function cancelReservation(
  id: string,
  userId: string,
  role: Role
): Promise<void> {
  const reservation = await findReservationById(id);

  if (!reservation) {
    throw new ReservationNotFoundError();
  }

  if (
    reservation.userId !== userId &&
    role !== "administrador"
  ) {
    throw new ReservationForbiddenError();
  }

  if (reservation.status === "cancelada") {
    return;
  }

  const cancelled = await cancelReservationById(id);

  if (!cancelled) {
    throw new ReservationNotFoundError();
  }

  await invalidateCache();

  await notifyReservation(
    "reservation.cancelled",
    cancelled
  );
}