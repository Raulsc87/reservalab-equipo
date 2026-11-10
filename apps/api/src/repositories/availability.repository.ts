import { and, asc, eq, gt, lt } from "drizzle-orm";
import { db } from "../db/client.js";
import { reservations } from "../db/schema.js";

export async function findReservationsForSpacePeriod(
  spaceId: string,
  startsAt: Date,
  endsAt: Date
) {
  return db
    .select({
      startsAt: reservations.startsAt,
      endsAt: reservations.endsAt
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.spaceId, spaceId),
        eq(reservations.status, "confirmada"),
        lt(reservations.startsAt, endsAt),
        gt(reservations.endsAt, startsAt)
      )
    )
    .orderBy(asc(reservations.startsAt));
}