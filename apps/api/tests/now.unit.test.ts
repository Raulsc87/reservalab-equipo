import {
  beforeEach,
  afterEach,
  expect,
  it,
  vi
} from "vitest";

const mocks = vi.hoisted(() => ({
  listCurrentOccupancy: vi.fn()
}));

vi.mock("../src/repositories/now.repository.js", () => mocks);

import { getNow } from "../src/services/now.service.js";

const row = {
  id: "espacio-prueba",
  name: "Laboratorio",
  building: "Edificio A",
  location: "Primer nivel",
  capacity: 25,
  opensAt: "08:00:00",
  closesAt: "18:00:00",
  reservationId: null,
  reservationStartsAt: null,
  reservationEndsAt: null
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  mocks.listCurrentOccupancy.mockResolvedValue([row]);
});

afterEach(() => {
  vi.useRealTimers();
});

it.each([
  ["2030-01-15T13:59:59Z", "cerrado"],
  ["2030-01-15T14:00:00Z", "libre"],
  ["2030-01-15T18:00:00Z", "libre"],
  ["2030-01-16T00:00:00Z", "cerrado"]
])("calcula el estado a las %s: %s", async (instant, status) => {
  vi.setSystemTime(new Date(instant));

  const result = await getNow({});

  expect(result.checkedAt).toBe(new Date(instant).toISOString());
  expect(result.timezone).toBe("America/Guatemala");
  expect(result.spaces[0]?.status).toBe(status);
  expect(result.spaces[0]?.reservation).toBeNull();
});

it("muestra ocupado cuando existe una reserva actual", async () => {
  vi.setSystemTime(new Date("2030-01-15T16:30:00Z"));

  const startsAt = new Date("2030-01-15T16:00:00Z");
  const endsAt = new Date("2030-01-15T17:00:00Z");

  mocks.listCurrentOccupancy.mockResolvedValue([{
    ...row,
    reservationId: "reserva-prueba",
    reservationStartsAt: startsAt,
    reservationEndsAt: endsAt
  }]);

  const result = await getNow({});

  expect(result.spaces[0]?.status).toBe("ocupado");
  expect(result.spaces[0]?.reservation).toEqual({
    startsAt,
    endsAt
  });
});

it("envía el filtro de edificio y el instante al repositorio", async () => {
  const instant = new Date("2030-01-15T16:30:00Z");
  vi.setSystemTime(instant);

  await getNow({ building: "Edificio A" });

  expect(mocks.listCurrentOccupancy).toHaveBeenCalledWith(
    { building: "Edificio A" },
    instant
  );
});

it("devuelve una lista vacía si no hay espacios", async () => {
  vi.setSystemTime(new Date("2030-01-15T16:30:00Z"));
  mocks.listCurrentOccupancy.mockResolvedValue([]);

  const result = await getNow({});

  expect(result.spaces).toEqual([]);
});