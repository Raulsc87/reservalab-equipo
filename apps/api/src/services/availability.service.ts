import { getSpace } from "./spaces.service.js";
import {
  findReservationsForSpacePeriod
} from "../repositories/availability.repository.js";

interface TimePeriod {
  startsAt: string;
  endsAt: string;
}

export async function getSpaceAvailability(
  spaceId: string,
  date: string
) {
  const space = await getSpace(spaceId);

  // Interpretamos el horario del espacio como hora de Guatemala.
  const opening = new Date(
    `${date}T${space.opensAt}-06:00`
  );

  const closing = new Date(
    `${date}T${space.closesAt}-06:00`
  );

  const reservations = await findReservationsForSpacePeriod(
    spaceId,
    opening,
    closing
  );

  const occupied: TimePeriod[] = [];
  const available: TimePeriod[] = [];

  const openingTime = opening.getTime();
  const closingTime = closing.getTime();

  let cursor = openingTime;

  for (const reservation of reservations) {
    // Limitamos cada reserva al horario de apertura y cierre.
    const start = Math.max(
      reservation.startsAt.getTime(),
      openingTime
    );

    const end = Math.min(
      reservation.endsAt.getTime(),
      closingTime
    );

    if (start >= end) {
      continue;
    }

    // El tiempo anterior a esta reserva está disponible.
    if (start > cursor) {
      available.push({
        startsAt: new Date(cursor).toISOString(),
        endsAt: new Date(start).toISOString()
      });
    }

    occupied.push({
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString()
    });

    cursor = Math.max(cursor, end);
  }

  // Agregamos el tiempo libre después de la última reserva.
  if (cursor < closingTime) {
    available.push({
      startsAt: new Date(cursor).toISOString(),
      endsAt: closing.toISOString()
    });
  }

  return {
    date,
    timezone: "America/Guatemala",
    space: {
      id: space.id,
      name: space.name,
      opensAt: space.opensAt,
      closesAt: space.closesAt
    },
    occupied,
    available
  };
}