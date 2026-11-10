import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hash: vi.fn(),
  compare: vi.fn(),
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  createAccessToken: vi.fn(),
  createRefreshToken: vi.fn(),
  saveRefreshToken: vi.fn()
}));

vi.mock("bcryptjs", () => ({
  hash: mocks.hash,
  compare: mocks.compare
}));

vi.mock("../src/repositories/users.repository.js", () => ({
  createUser: mocks.createUser,
  findUserByEmail: mocks.findUserByEmail
}));

vi.mock("../src/services/tokens.service.js", () => ({
  createAccessToken: mocks.createAccessToken,
  createRefreshToken: mocks.createRefreshToken
}));

vi.mock("../src/repositories/refresh-tokens.repository.js", () => ({
  saveRefreshToken: mocks.saveRefreshToken
}));

import {
  registerUser,
  loginUser
} from "../src/services/auth.service.js";

const user = {
  id: "usuario-prueba",
  name: "Docente",
  email: "docente@reservalab.test",
  passwordHash: "hash-password",
  role: "docente",
  active: true
};

const credentials = {
  email: "DOCENTE@reservalab.test",
  password: "ReservaLab2026!"
};

const refresh = {
  token: "refresh-original",
  tokenHash: "hash-refresh",
  expiresAt: new Date("2030-01-22T00:00:00Z")
};

beforeEach(() => {
  vi.resetAllMocks();

  mocks.hash.mockResolvedValue("hash-password");
  mocks.compare.mockResolvedValue(true);
  mocks.createUser.mockResolvedValue(user);
  mocks.findUserByEmail.mockResolvedValue(user);
  mocks.createAccessToken.mockReturnValue("access-prueba");
  mocks.createRefreshToken.mockReturnValue(refresh);
  mocks.saveRefreshToken.mockResolvedValue(undefined);
});

it("registra con contraseña cifrada y correo en minúsculas", async () => {
  await registerUser({
    name: "Docente",
    ...credentials
  });

  expect(mocks.hash).toHaveBeenCalledWith(
    credentials.password,
    12
  );

  expect(mocks.createUser).toHaveBeenCalledWith({
    name: "Docente",
    email: "docente@reservalab.test",
    passwordHash: "hash-password"
  });
});

it("inicia sesión sin exponer el hash de contraseña", async () => {
  const result = await loginUser(credentials);

  expect(mocks.findUserByEmail).toHaveBeenCalledWith(
    "docente@reservalab.test"
  );

  expect(mocks.compare).toHaveBeenCalledWith(
    credentials.password,
    user.passwordHash
  );

  expect(result?.accessToken).toBe("access-prueba");
  expect(result?.refreshToken).toBe(refresh.token);
  expect(result?.user).not.toHaveProperty("passwordHash");

  expect(mocks.saveRefreshToken).toHaveBeenCalledWith({
    userId: user.id,
    tokenHash: refresh.tokenHash,
    expiresAt: refresh.expiresAt
  });
});

it.each([
  undefined,
  { ...user, active: false }
])("rechaza usuarios inexistentes o desactivados", async (value) => {
  mocks.findUserByEmail.mockResolvedValue(value);

  await expect(loginUser(credentials)).resolves.toBeNull();

  expect(mocks.compare).not.toHaveBeenCalled();
  expect(mocks.saveRefreshToken).not.toHaveBeenCalled();
});

it("rechaza una contraseña incorrecta", async () => {
  mocks.compare.mockResolvedValue(false);

  await expect(loginUser(credentials)).resolves.toBeNull();

  expect(mocks.createAccessToken).not.toHaveBeenCalled();
  expect(mocks.saveRefreshToken).not.toHaveBeenCalled();
});

it("rechaza contraseñas que superen 72 bytes", async () => {
  await expect(loginUser({
    ...credentials,
    password: "á".repeat(37)
  })).resolves.toBeNull();

  expect(mocks.findUserByEmail).not.toHaveBeenCalled();
  expect(mocks.compare).not.toHaveBeenCalled();
});