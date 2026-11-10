import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

const mocks = vi.hoisted(() => ({
  findReservationById: vi.fn(),
  listReservationsByUser: vi.fn(),
  findReservationOverlap: vi.fn(),
  insertReservation: vi.fn(),
  cancelReservationById: vi.fn(),
  getSpace: vi.fn(),
  invalidateCache: vi.fn(),
  notifyReservation: vi.fn()
}));

vi.mock("../src/repositories/reservations.repository.js", () => ({
  findReservationById: mocks.findReservationById,
  listReservationsByUser: mocks.listReservationsByUser,
  findReservationOverlap: mocks.findReservationOverlap,
  insertReservation: mocks.insertReservation,
  cancelReservationById: mocks.cancelReservationById
}));

vi.mock("../src/services/spaces.service.js", () => ({
  getSpace: mocks.getSpace
}));

vi.mock("../src/services/cache.service.js", () => ({
  invalidateCache: mocks.invalidateCache
}));

vi.mock("../src/services/notifications.service.js", () => ({
  notifyReservation: mocks.notifyReservation
}));

import {
  createReservation,
  getMyReservations,
  cancelReservation,
  InvalidReservationError,
  ReservationConflictError,
  ReservationNotFoundError,
  ReservationForbiddenError
} from "../src/services/reservations.service.js";

const userId = "10000000-0000-4000-8000-000000000001";
const otherUserId = "10000000-0000-4000-8000-000000000002";
const spaceId = "20000000-0000-4000-8000-000000000001";
const reservationId = "30000000-0000-4000-8000-000000000001";

const input = {
  spaceId,
  purpose: "Práctica de arquitectura",
  startsAt: "2030-01-15T10:00:00-06:00",
  endsAt: "2030-01-15T11:00:00-06:00"
};

const reservation = {
  id: reservationId,
  userId,
  spaceId,
  purpose: input.purpose,
  startsAt: new Date(input.startsAt),
  endsAt: new Date(input.endsAt),
  status: "confirmada",
  createdAt: new Date("2029-01-01T00:00:00Z"),
  updatedAt: new Date("2029-01-01T00:00:00Z")
};

beforeEach(() => {
  vi.resetAllMocks();

  vi.spyOn(Date, "now").mockReturnValue(
    Date.parse("2029-01-01T00:00:00Z")
  );

  mocks.getSpace.mockResolvedValue({
    id: spaceId,
    active: true,
    opensAt: "08:00:00",
    closesAt: "18:00:00"
  });

  mocks.findReservationOverlap.mockResolvedValue(undefined);
  mocks.insertReservation.mockResolvedValue(reservation);
  mocks.findReservationById.mockResolvedValue(reservation);
  mocks.cancelReservationById.mockResolvedValue({
    ...reservation,
    status: "cancelada"
  });

  mocks.invalidateCache.mockResolvedValue(undefined);
  mocks.notifyReservation.mockResolvedValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Crear reservas", () => {
  it("crea una reserva válida, invalida caché y notifica", async () => {
    const result = await createReservation(userId, input);

    expect(result).toEqual(reservation);
    expect(mocks.insertReservation).toHaveBeenCalledWith(
      userId,
      input
    );
    expect(mocks.invalidateCache).toHaveBeenCalledOnce();
    expect(mocks.notifyReservation).toHaveBeenCalledWith(
      "reservation.confirmed",
      reservation
    );
  });

  it.each([
    {
      ...input,
      startsAt: "fecha incorrecta"
    },
    {
      ...input,
      endsAt: "fecha incorrecta"
    },
    {
      ...input,
      endsAt: input.startsAt
    },
    {
      ...input,
      endsAt: "2030-01-15T09:00:00-06:00"
    }
  ])("rechaza períodos inválidos: %j", async (data) => {
    await expect(
      createReservation(userId, data)
    ).rejects.toBeInstanceOf(InvalidReservationError);

    expect(mocks.insertReservation).not.toHaveBeenCalled();
  });

  it("rechaza una reserva en el pasado", async () => {
    await expect(
      createReservation(userId, {
        ...input,
        startsAt: "2028-01-15T10:00:00-06:00",
        endsAt: "2028-01-15T11:00:00-06:00"
      })
    ).rejects.toBeInstanceOf(InvalidReservationError);

    expect(mocks.insertReservation).not.toHaveBeenCalled();
  });

  it.each([
    {
      ...input,
      startsAt: "2030-01-15T07:00:00-06:00"
    },
    {
      ...input,
      endsAt: "2030-01-15T19:00:00-06:00"
    },
    {
      ...input,
      endsAt: "2030-01-16T10:00:00-06:00"
    }
  ])("rechaza horarios fuera de apertura: %j", async (data) => {
    await expect(
      createReservation(userId, data)
    ).rejects.toBeInstanceOf(InvalidReservationError);

    expect(mocks.insertReservation).not.toHaveBeenCalled();
  });

  it("permite usar exactamente el horario de apertura y cierre", async () => {
    await createReservation(userId, {
      ...input,
      startsAt: "2030-01-15T08:00:00-06:00",
      endsAt: "2030-01-15T18:00:00-06:00"
    });

    expect(mocks.insertReservation).toHaveBeenCalledOnce();
  });

  it("rechaza una reserva cuando ya existe un traslape", async () => {
    mocks.findReservationOverlap.mockResolvedValue(reservation);

    await expect(
      createReservation(userId, input)
    ).rejects.toBeInstanceOf(ReservationConflictError);

    expect(mocks.insertReservation).not.toHaveBeenCalled();
    expect(mocks.notifyReservation).not.toHaveBeenCalled();
  });

  it("convierte la restricción de PostgreSQL en conflicto", async () => {
    mocks.insertReservation.mockRejectedValue({
      cause: {
        code: "23P01",
        constraint: "reservations_no_overlap"
      }
    });

    await expect(
      createReservation(userId, input)
    ).rejects.toBeInstanceOf(ReservationConflictError);

    expect(mocks.invalidateCache).not.toHaveBeenCalled();
    expect(mocks.notifyReservation).not.toHaveBeenCalled();
  });

  it("propaga errores de base de datos que no son conflictos", async () => {
    const error = new Error("Conexión perdida");
    mocks.insertReservation.mockRejectedValue(error);

    await expect(
      createReservation(userId, input)
    ).rejects.toBe(error);
  });

  it("no inserta cuando el espacio no está disponible", async () => {
    const error = new Error("Espacio no encontrado");
    mocks.getSpace.mockRejectedValue(error);

    await expect(
      createReservation(userId, input)
    ).rejects.toBe(error);

    expect(mocks.insertReservation).not.toHaveBeenCalled();
  });

  it("mantiene la reserva si el envío de notificación falla", async () => {
    mocks.notifyReservation.mockResolvedValue(false);

    await expect(
      createReservation(userId, input)
    ).resolves.toEqual(reservation);
  });
});

describe("Cancelar reservas", () => {
  it("permite al dueño cancelar su reserva", async () => {
    await cancelReservation(reservationId, userId, "docente");

    expect(mocks.cancelReservationById).toHaveBeenCalledWith(
      reservationId
    );
    expect(mocks.invalidateCache).toHaveBeenCalledOnce();
    expect(mocks.notifyReservation).toHaveBeenCalledWith(
      "reservation.cancelled",
      expect.objectContaining({ status: "cancelada" })
    );
  });

  it("permite al administrador cancelar una reserva ajena", async () => {
    await cancelReservation(
      reservationId,
      otherUserId,
      "administrador"
    );

    expect(mocks.cancelReservationById).toHaveBeenCalledOnce();
  });

  it("impide que un docente cancele una reserva ajena", async () => {
    await expect(
      cancelReservation(reservationId, otherUserId, "docente")
    ).rejects.toBeInstanceOf(ReservationForbiddenError);

    expect(mocks.cancelReservationById).not.toHaveBeenCalled();
    expect(mocks.invalidateCache).not.toHaveBeenCalled();
    expect(mocks.notifyReservation).not.toHaveBeenCalled();
  });

  it("rechaza una reserva inexistente", async () => {
    mocks.findReservationById.mockResolvedValue(undefined);

    await expect(
      cancelReservation(reservationId, userId, "docente")
    ).rejects.toBeInstanceOf(ReservationNotFoundError);
  });

  it("no vuelve a cancelar ni notificar una reserva cancelada", async () => {
    mocks.findReservationById.mockResolvedValue({
      ...reservation,
      status: "cancelada"
    });

    await expect(
      cancelReservation(reservationId, userId, "docente")
    ).resolves.toBeUndefined();

    expect(mocks.cancelReservationById).not.toHaveBeenCalled();
    expect(mocks.invalidateCache).not.toHaveBeenCalled();
    expect(mocks.notifyReservation).not.toHaveBeenCalled();
  });

  it("maneja que la reserva desaparezca antes de actualizar", async () => {
    mocks.cancelReservationById.mockResolvedValue(undefined);

    await expect(
      cancelReservation(reservationId, userId, "docente")
    ).rejects.toBeInstanceOf(ReservationNotFoundError);

    expect(mocks.notifyReservation).not.toHaveBeenCalled();
  });
});

describe("Consultar mis reservas", () => {
  it("consulta únicamente por el usuario recibido", async () => {
    mocks.listReservationsByUser.mockResolvedValue([reservation]);

    const result = await getMyReservations(userId);

    expect(mocks.listReservationsByUser).toHaveBeenCalledWith(userId);
    expect(result).toEqual([reservation]);
  });
});