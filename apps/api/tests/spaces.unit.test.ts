import {
  beforeEach,
  expect,
  it,
  vi
} from "vitest";

const mocks = vi.hoisted(() => ({
  listSpaces: vi.fn(),
  findSpaceById: vi.fn(),
  insertSpace: vi.fn(),
  updateSpaceById: vi.fn(),
  deactivateSpaceById: vi.fn(),
  invalidateCache: vi.fn()
}));

vi.mock("../src/repositories/spaces.repository.js", () => ({
  listSpaces: mocks.listSpaces,
  findSpaceById: mocks.findSpaceById,
  insertSpace: mocks.insertSpace,
  updateSpaceById: mocks.updateSpaceById,
  deactivateSpaceById: mocks.deactivateSpaceById
}));

vi.mock("../src/services/cache.service.js", () => ({
  invalidateCache: mocks.invalidateCache
}));

import {
  getSpaces,
  getSpace,
  createSpace,
  editSpace,
  deleteSpace,
  SpaceNotFoundError,
  InvalidSpaceScheduleError
} from "../src/services/spaces.service.js";

const space = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "Laboratorio de prueba",
  description: null,
  building: "Edificio A",
  location: "Primer nivel",
  capacity: 25,
  opensAt: "08:00:00",
  closesAt: "18:00:00",
  active: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

const input = {
  name: space.name,
  building: space.building,
  location: space.location,
  capacity: space.capacity
};

beforeEach(() => {
  vi.resetAllMocks();

  mocks.findSpaceById.mockResolvedValue(space);
  mocks.insertSpace.mockResolvedValue(space);
  mocks.updateSpaceById.mockResolvedValue(space);
  mocks.deactivateSpaceById.mockResolvedValue({
    ...space,
    active: false
  });
  mocks.invalidateCache.mockResolvedValue(undefined);
});

it("envía los filtros de edificio y capacidad al repositorio", async () => {
  mocks.listSpaces.mockResolvedValue([space]);

  const filters = {
    building: "Edificio A",
    capacity: 20
  };

  await expect(getSpaces(filters)).resolves.toEqual([space]);

  expect(mocks.listSpaces).toHaveBeenCalledWith(filters);
});

it("devuelve un espacio activo", async () => {
  await expect(getSpace(space.id)).resolves.toEqual(space);
});

it.each([
  undefined,
  { ...space, active: false }
])("rechaza espacios inexistentes o inactivos", async (result) => {
  mocks.findSpaceById.mockResolvedValue(result);

  await expect(
    getSpace(space.id)
  ).rejects.toBeInstanceOf(SpaceNotFoundError);
});

it("crea con horario predeterminado e invalida caché", async () => {
  await createSpace(input);

  expect(mocks.insertSpace).toHaveBeenCalledWith({
    ...input,
    opensAt: "07:00",
    closesAt: "22:00"
  });

  expect(mocks.invalidateCache).toHaveBeenCalledOnce();
});

it.each([
  { opensAt: "18:00", closesAt: "08:00" },
  { opensAt: "08:00", closesAt: "08:00" }
])("rechaza horarios inválidos: %j", async (schedule) => {
  await expect(
    createSpace({ ...input, ...schedule })
  ).rejects.toBeInstanceOf(InvalidSpaceScheduleError);

  expect(mocks.insertSpace).not.toHaveBeenCalled();
  expect(mocks.invalidateCache).not.toHaveBeenCalled();
});

it("valida un cambio parcial contra el horario guardado", async () => {
  await expect(
    editSpace(space.id, { closesAt: "07:00" })
  ).rejects.toBeInstanceOf(InvalidSpaceScheduleError);

  expect(mocks.updateSpaceById).not.toHaveBeenCalled();
});

it("actualiza un horario válido e invalida caché", async () => {
  await editSpace(space.id, { closesAt: "19:00" });

  expect(mocks.updateSpaceById).toHaveBeenCalledWith(
    space.id,
    { closesAt: "19:00" }
  );

  expect(mocks.invalidateCache).toHaveBeenCalledOnce();
});

it("rechaza actualizar un espacio inexistente", async () => {
  mocks.findSpaceById.mockResolvedValue(undefined);

  await expect(
    editSpace(space.id, { capacity: 30 })
  ).rejects.toBeInstanceOf(SpaceNotFoundError);

  expect(mocks.updateSpaceById).not.toHaveBeenCalled();
});

it("desactiva el espacio e invalida caché", async () => {
  await deleteSpace(space.id);

  expect(mocks.deactivateSpaceById).toHaveBeenCalledWith(
    space.id
  );

  expect(mocks.invalidateCache).toHaveBeenCalledOnce();
});

it("rechaza eliminar un espacio inexistente", async () => {
  mocks.deactivateSpaceById.mockResolvedValue(undefined);

  await expect(
    deleteSpace(space.id)
  ).rejects.toBeInstanceOf(SpaceNotFoundError);

  expect(mocks.invalidateCache).not.toHaveBeenCalled();
});