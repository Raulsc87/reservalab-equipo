import { and, asc, eq, gt, lt } from "drizzle-orm";
import type {
  CreateReservationInput
} from "@reservalab/shared";
import { db } from "../db/client.js";
import { reservations } from "../db/schema.js";

export async function findReservationById(id: string) {
  const [reservation] = await db
    .select()
    .from(reservations)
    .where(eq(reservations.id, id))
    .limit(1);

  return reservation;
}

export async function listReservationsByUser(userId: string) {
  return db
    .select()
    .from(reservations)
    .where(eq(reservations.userId, userId))
    .orderBy(asc(reservations.startsAt));
}

export async function findReservationOverlap(
  spaceId: string,
  startsAt: Date,
  endsAt: Date
) {
  const [reservation] = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(
      and(
        eq(reservations.spaceId, spaceId),
        eq(reservations.status, "confirmada"),
        lt(reservations.startsAt, endsAt),
        gt(reservations.endsAt, startsAt)
      )
    )
    .limit(1);

  return reservation;
}

export async function insertReservation(
  userId: string,
  data: CreateReservationInput
) {
  const [reservation] = await db
    .insert(reservations)
    .values({
      userId,
      spaceId: data.spaceId,
      purpose: data.purpose,
      startsAt: new Date(data.startsAt),
      endsAt: new Date(data.endsAt)
    })
    .returning();

  if (!reservation) {
    throw new Error("No se pudo guardar la reserva");
  }

  return reservation;
}

export async function cancelReservationById(id: string) {
  const [reservation] = await db
    .update(reservations)
    .set({
      status: "cancelada",
      updatedAt: new Date()
    })
    .where(eq(reservations.id, id))
    .returning();

  return reservation;
}