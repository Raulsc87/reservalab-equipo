import {
  beforeEach,
  expect,
  it,
  vi
} from "vitest";

const mocks = vi.hoisted(() => ({
  checkDatabase: vi.fn(),
  checkCache: vi.fn()
}));

vi.mock("../src/repositories/health.repository.js", () => mocks);

import {
  getHealthStatus
} from "../src/services/health.service.js";

beforeEach(() => {
  vi.resetAllMocks();
});

it.each([
  [true, true, "ok", "up", "up"],
  [false, true, "error", "down", "up"],
  [true, false, "error", "up", "down"],
  [false, false, "error", "down", "down"]
])(
  "comprueba servicios: PostgreSQL=%s Redis=%s",
  async (databaseWorks, cacheWorks, status, database, cache) => {
    if (databaseWorks) {
      mocks.checkDatabase.mockResolvedValue(undefined);
    } else {
      mocks.checkDatabase.mockRejectedValue(
        new Error("PostgreSQL desconectado")
      );
    }

    if (cacheWorks) {
      mocks.checkCache.mockResolvedValue(undefined);
    } else {
      mocks.checkCache.mockRejectedValue(
        new Error("Redis desconectado")
      );
    }

    await expect(getHealthStatus()).resolves.toEqual({
      status,
      service: "reservalab-api",
      database,
      cache
    });
  }
);