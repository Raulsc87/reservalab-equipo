import {
  beforeEach,
  afterEach,
  expect,
  it,
  vi
} from "vitest";

import {
  notifyReservation
} from "../src/services/notifications.service.js";

const fetchMock = vi.fn();

const reservation = {
  id: "reserva-prueba",
  userId: "usuario-prueba",
  spaceId: "espacio-prueba",
  purpose: "Prueba de notificaciones",
  startsAt: new Date("2030-01-15T16:00:00Z"),
  endsAt: new Date("2030-01-15T17:00:00Z")
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NOTIFICATIONS_URL", "http://notificaciones.test/");

  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it.each([
  "reservation.confirmed",
  "reservation.cancelled"
] as const)(
  "envía correctamente el evento %s",
  async (event) => {
    fetchMock.mockResolvedValue({ status: 202 });

    await expect(
      notifyReservation(event, reservation)
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, options] = fetchMock.mock.calls[0]!;

    expect(url).toBe(
      "http://notificaciones.test/notifications"
    );

    expect(options.method).toBe("POST");

    expect(JSON.parse(options.body)).toEqual({
      event,
      occurredAt: expect.any(String),
      reservation: {
        id: reservation.id,
        userId: reservation.userId,
        spaceId: reservation.spaceId,
        purpose: reservation.purpose,
        startsAt: reservation.startsAt.toISOString(),
        endsAt: reservation.endsAt.toISOString()
      }
    });
  }
);

it("informa un fallo cuando el servicio responde 500", async () => {
  fetchMock.mockResolvedValue({ status: 500 });

  await expect(
    notifyReservation("reservation.confirmed", reservation)
  ).resolves.toBe(false);
});

it("maneja una caída de red sin lanzar el error al usuario", async () => {
  fetchMock.mockRejectedValue(
    new Error("Servicio no disponible")
  );

  await expect(
    notifyReservation("reservation.cancelled", reservation)
  ).resolves.toBe(false);
});