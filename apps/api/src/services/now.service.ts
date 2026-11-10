import type { NowQuery } from "@reservalab/shared";
import {
  listCurrentOccupancy
} from "../repositories/now.repository.js";

function timeToSeconds(time: string): number {
  const [hours = "0", minutes = "0", seconds = "0"] =
    time.split(":");

  return (
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds)
  );
}

export async function getNow(filters: NowQuery) {
  const now = new Date();

  const rows = await listCurrentOccupancy(filters, now);

  // Guatemala utiliza UTC-6.
  const localTime = new Date(
    now.getTime() - 6 * 60 * 60 * 1000
  );

  const currentSeconds =
    localTime.getUTCHours() * 3600 +
    localTime.getUTCMinutes() * 60 +
    localTime.getUTCSeconds();

  const spaces = rows.map((row) => {
    const isOpen =
      currentSeconds >= timeToSeconds(row.opensAt) &&
      currentSeconds < timeToSeconds(row.closesAt);

    let status: "ocupado" | "libre" | "cerrado";

    if (row.reservationId !== null) {
      status = "ocupado";
    } else {
      status = isOpen ? "libre" : "cerrado";
    }

    return {
      id: row.id,
      name: row.name,
      building: row.building,
      location: row.location,
      capacity: row.capacity,
      opensAt: row.opensAt,
      closesAt: row.closesAt,
      status,
      reservation: row.reservationId !== null
        ? {
            startsAt: row.reservationStartsAt,
            endsAt: row.reservationEndsAt
          }
        : null
    };
  });

  return {
    checkedAt: now.toISOString(),
    timezone: "America/Guatemala",
    spaces
  };
}