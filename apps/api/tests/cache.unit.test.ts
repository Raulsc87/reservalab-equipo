import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn()
}));

vi.mock("../src/db/redis.js", () => ({
  redis: mocks
}));

import {
  cachedQuery,
  invalidateCache
} from "../src/services/cache.service.js";

const revisionKey = "reservalab:cache:revision";
let storage: Map<string, string>;

beforeEach(() => {
  vi.resetAllMocks();
  storage = new Map();

  mocks.get.mockImplementation(async (key: string) => {
    return storage.get(key) ?? null;
  });

  mocks.set.mockImplementation(
    async (key: string, value: string) => {
      storage.set(key, value);
      return "OK";
    }
  );
});

it("guarda un MISS con vencimiento de 60 segundos", async () => {
  const load = vi.fn().mockResolvedValue({ spaces: [] });

  await expect(
    cachedQuery("spaces", load)
  ).resolves.toEqual({
    data: { spaces: [] },
    cache: "MISS"
  });

  expect(load).toHaveBeenCalledOnce();

  expect(mocks.set).toHaveBeenCalledWith(
    expect.stringMatching(/^reservalab:cache:data:/),
    JSON.stringify({ spaces: [] }),
    "EX",
    60
  );
});

it("devuelve HIT sin volver a consultar los datos", async () => {
  const load = vi.fn().mockResolvedValue({ value: 1 });

  await cachedQuery("spaces", load);
  const result = await cachedQuery("spaces", load);

  expect(result).toEqual({
    data: { value: 1 },
    cache: "HIT"
  });

  expect(load).toHaveBeenCalledOnce();
});

it("separa recursos con filtros diferentes", async () => {
  const loadA = vi.fn().mockResolvedValue(["Edificio A"]);
  const loadB = vi.fn().mockResolvedValue(["Edificio B"]);

  await cachedQuery("spaces:A", loadA);
  const result = await cachedQuery("spaces:B", loadB);

  expect(result).toEqual({
    data: ["Edificio B"],
    cache: "MISS"
  });

  expect(loadB).toHaveBeenCalledOnce();
});

it("vuelve a cargar después de invalidar la caché", async () => {
  const load = vi.fn()
    .mockResolvedValueOnce({ value: 1 })
    .mockResolvedValueOnce({ value: 2 });

  await cachedQuery("spaces", load);
  await invalidateCache();

  const result = await cachedQuery("spaces", load);

  expect(storage.get(revisionKey)).toBeTruthy();
  expect(result).toEqual({
    data: { value: 2 },
    cache: "MISS"
  });

  expect(load).toHaveBeenCalledTimes(2);
});

it("repite la consulta si los datos cambian mientras carga", async () => {
  const load = vi.fn()
    .mockImplementationOnce(async () => {
      storage.set(revisionKey, "nueva-version");
      return { value: "anterior" };
    })
    .mockResolvedValueOnce({ value: "actual" });

  const result = await cachedQuery("spaces", load);

  expect(result).toEqual({
    data: { value: "actual" },
    cache: "MISS"
  });

  expect(load).toHaveBeenCalledTimes(2);
});

it("propaga un fallo de carga sin guardar datos incorrectos", async () => {
  const error = new Error("Base de datos desconectada");
  const load = vi.fn().mockRejectedValue(error);

  await expect(
    cachedQuery("spaces", load)
  ).rejects.toBe(error);

  expect(mocks.set).not.toHaveBeenCalled();
});