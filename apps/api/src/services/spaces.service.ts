import type {
  CreateSpaceInput,
  UpdateSpaceInput,
  ListSpacesQuery
} from "@reservalab/shared";

import {
  listSpaces,
  findSpaceById,
  insertSpace,
  updateSpaceById,
  deactivateSpaceById
} from "../repositories/spaces.repository.js";

import { invalidateCache } from "./cache.service.js";

export class SpaceNotFoundError extends Error {
  constructor() {
    super("Espacio no encontrado");
    this.name = "SpaceNotFoundError";
  }
}

export class InvalidSpaceScheduleError extends Error {
  constructor() {
    super("La hora de cierre debe ser posterior a la hora de apertura");
    this.name = "InvalidSpaceScheduleError";
  }
}

function timeToSeconds(time: string): number {
  const [hours = "0", minutes = "0", seconds = "0"] =
    time.split(":");

  return (
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds)
  );
}

function validateSchedule(
  opensAt: string,
  closesAt: string
): void {
  if (timeToSeconds(closesAt) <= timeToSeconds(opensAt)) {
    throw new InvalidSpaceScheduleError();
  }
}

export async function getSpaces(filters: ListSpacesQuery) {
  return listSpaces(filters);
}

export async function getSpace(id: string) {
  const space = await findSpaceById(id);

  if (!space || !space.active) {
    throw new SpaceNotFoundError();
  }

  return space;
}

export async function createSpace(data: CreateSpaceInput) {
  const opensAt = data.opensAt ?? "07:00";
  const closesAt = data.closesAt ?? "22:00";

  validateSchedule(opensAt, closesAt);

  const space = await insertSpace({
    ...data,
    opensAt,
    closesAt
  });

  await invalidateCache();

  return space;
}

export async function editSpace(
  id: string,
  data: UpdateSpaceInput
) {
  const currentSpace = await findSpaceById(id);

  if (!currentSpace) {
    throw new SpaceNotFoundError();
  }

  const opensAt = data.opensAt ?? currentSpace.opensAt;
  const closesAt = data.closesAt ?? currentSpace.closesAt;

  validateSchedule(opensAt, closesAt);

  const space = await updateSpaceById(id, data);

  if (!space) {
    throw new SpaceNotFoundError();
  }

  await invalidateCache();

  return space;
}

export async function deleteSpace(id: string): Promise<void> {
  const space = await deactivateSpaceById(id);

  if (!space) {
    throw new SpaceNotFoundError();
  }

  await invalidateCache();
}