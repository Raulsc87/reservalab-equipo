import { and, asc, eq, gte, type SQL } from "drizzle-orm";
import type {
  CreateSpaceInput,
  UpdateSpaceInput,
  ListSpacesQuery
} from "@reservalab/shared";
import { db } from "../db/client.js";
import { spaces } from "../db/schema.js";

export async function listSpaces(filters: ListSpacesQuery) {
  const conditions: SQL[] = [
    eq(spaces.active, true)
  ];

  if (filters.building !== undefined) {
    conditions.push(eq(spaces.building, filters.building));
  }

  if (filters.capacity !== undefined) {
    conditions.push(gte(spaces.capacity, filters.capacity));
  }

  return db
    .select()
    .from(spaces)
    .where(and(...conditions))
    .orderBy(asc(spaces.name), asc(spaces.id));
}

export async function findSpaceById(id: string) {
  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.id, id))
    .limit(1);

  return space;
}

export async function insertSpace(data: CreateSpaceInput) {
  const [space] = await db
    .insert(spaces)
    .values(data)
    .returning();

  if (!space) {
    throw new Error("No se pudo crear el espacio");
  }

  return space;
}

export async function updateSpaceById(
  id: string,
  data: UpdateSpaceInput
) {
  const [space] = await db
    .update(spaces)
    .set({
      ...data,
      updatedAt: new Date()
    })
    .where(eq(spaces.id, id))
    .returning();

  return space;
}

export async function deactivateSpaceById(id: string) {
  const [space] = await db
    .update(spaces)
    .set({
      active: false,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(spaces.id, id),
        eq(spaces.active, true)
      )
    )
    .returning();

  return space;
}