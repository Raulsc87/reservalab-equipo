import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSpace: vi.fn(),
  findReservationsForSpacePeriod: vi.fn()
}));

vi.mock("../src/services/spaces.service.js", () => ({
  getSpace: mocks.getSpace
}));

vi.mock("../src/repositories/availability.repository.js", () => ({
  findReservationsForSpacePeriod:
    mocks.findReservationsForSpacePeriod
}));

import {
  getSpaceAvailability
} from "../src/services/availability.service.js";

const spaceId = "20000000-0000-4000-8000-000000000001";

function period(start: string, end: string) {
  return {
    startsAt: new Date(`2030-01-15T${start}:00-06:00`),
    endsAt: new Date(`2030-01-15T${end}:00-06:00`)
  };
}

function expectedPeriod(start: string, end: string) {
  const value = period(start, end);

  return {
    startsAt: value.startsAt.toISOString(),
    endsAt: value.endsAt.toISOString()
  };
}

beforeEach(() => {
  vi.resetAllMocks();

  mocks.getSpace.mockResolvedValue({
    id: spaceId,
    name: "Laboratorio",
    opensAt: "08:00:00",
    closesAt: "18:00:00"
  });

  mocks.findReservationsForSpacePeriod.mockResolvedValue([]);
});

it("devuelve toda la jornada libre cuando no hay reservas", async () => {
  const result = await getSpaceAvailability(spaceId, "2030-01-15");

  expect(result.timezone).toBe("America/Guatemala");
  expect(result.occupied).toEqual([]);
  expect(result.available).toEqual([
    expectedPeriod("08:00", "18:00")
  ]);

  expect(mocks.findReservationsForSpacePeriod).toHaveBeenCalledWith(
    spaceId,
    period("08:00", "18:00").startsAt,
    period("08:00", "18:00").endsAt
  );
});

it("divide el tiempo libre alrededor de una reserva", async () => {
  mocks.findReservationsForSpacePeriod.mockResolvedValue([
    period("10:00", "11:00")
  ]);

  const result = await getSpaceAvailability(spaceId, "2030-01-15");

  expect(result.occupied).toEqual([
    expectedPeriod("10:00", "11:00")
  ]);

  expect(result.available).toEqual([
    expectedPeriod("08:00", "10:00"),
    expectedPeriod("11:00", "18:00")
  ]);
});

it("no inventa un período libre entre reservas consecutivas", async () => {
  mocks.findReservationsForSpacePeriod.mockResolvedValue([
    period("10:00", "11:00"),
    period("11:00", "12:00")
  ]);

  const result = await getSpaceAvailability(spaceId, "2030-01-15");

  expect(result.available).toEqual([
    expectedPeriod("08:00", "10:00"),
    expectedPeriod("12:00", "18:00")
  ]);
});

it("devuelve cero períodos libres si toda la jornada está ocupada", async () => {
  mocks.findReservationsForSpacePeriod.mockResolvedValue([
    period("08:00", "18:00")
  ]);

  const result = await getSpaceAvailability(spaceId, "2030-01-15");

  expect(result.available).toEqual([]);
  expect(result.occupied).toEqual([
    expectedPeriod("08:00", "18:00")
  ]);
});

it("recorta una reserva que excede el horario del espacio", async () => {
  mocks.findReservationsForSpacePeriod.mockResolvedValue([
    period("07:00", "19:00")
  ]);

  const result = await getSpaceAvailability(spaceId, "2030-01-15");

  expect(result.available).toEqual([]);
  expect(result.occupied).toEqual([
    expectedPeriod("08:00", "18:00")
  ]);
});

it("ignora períodos sin intersección con la jornada", async () => {
  mocks.findReservationsForSpacePeriod.mockResolvedValue([
    period("06:00", "08:00"),
    period("18:00", "19:00")
  ]);

  const result = await getSpaceAvailability(spaceId, "2030-01-15");

  expect(result.occupied).toEqual([]);
  expect(result.available).toEqual([
    expectedPeriod("08:00", "18:00")
  ]);
});

it("propaga el rechazo de un espacio inexistente", async () => {
  const error = new Error("Espacio no encontrado");
  mocks.getSpace.mockRejectedValue(error);

  await expect(
    getSpaceAvailability(spaceId, "2030-01-15")
  ).rejects.toBe(error);

  expect(
    mocks.findReservationsForSpacePeriod
  ).not.toHaveBeenCalled();
});