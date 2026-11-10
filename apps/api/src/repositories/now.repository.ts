import { and, asc, eq, gt, lte } from "drizzle-orm";
import type { NowQuery } from "@reservalab/shared";
import { db } from "../db/client.js";
import { spaces, reservations } from "../db/schema.js";

export async function listCurrentOccupancy(
  filters: NowQuery,
  now: Date
) {
  return db
    .select({
      id: spaces.id,
      name: spaces.name,
      building: spaces.building,
      location: spaces.location,
      capacity: spaces.capacity,
      opensAt: spaces.opensAt,
      closesAt: spaces.closesAt,
      reservationId: reservations.id,
      reservationStartsAt: reservations.startsAt,
      reservationEndsAt: reservations.endsAt
    })
    .from(spaces)
    .leftJoin(
      reservations,
      and(
        eq(reservations.spaceId, spaces.id),
        eq(reservations.status, "confirmada"),
        lte(reservations.startsAt, now),
        gt(reservations.endsAt, now)
      )
    )
    .where(
      and(
        eq(spaces.active, true),
        filters.building !== undefined
          ? eq(spaces.building, filters.building)
          : undefined
      )
    )
    .orderBy(
      asc(spaces.building),
      asc(spaces.name),
      asc(spaces.id)
    );
}