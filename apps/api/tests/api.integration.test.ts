import {
  beforeAll,
  afterAll,
  expect,
  it,
  vi
} from "vitest";
import request from "supertest";
import pg from "pg";
import { config } from "dotenv";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Express } from "express";

config({
  path: resolve(process.cwd(), "../../.env"),
  quiet: true
});

const databaseName =
  `reservalab_test_${randomUUID().replaceAll("-", "")}`;

const password = "ReservaLab2026!";

const adminPool = new pg.Pool({
  host: "127.0.0.1",
  port: 5433,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  connectionTimeoutMillis: 5000
});

let createdDatabase = false;
let app: Express;
let connection:
  typeof import("../src/db/client.js") | undefined;
let cache:
  typeof import("../src/db/redis.js") | undefined;

beforeAll(async () => {
  await adminPool.query(`CREATE DATABASE "${databaseName}"`);
  createdDatabase = true;

  vi.stubEnv("POSTGRES_DB", databaseName);
  vi.stubEnv(
    "JWT_ACCESS_SECRET",
    "secreto-exclusivo-de-pruebas-".repeat(4)
  );

  connection = await import("../src/db/client.js");

  await migrate(connection.db, {
    migrationsFolder: resolve(process.cwd(), "drizzle")
  });

  const { users } = await import("../src/db/schema.js");
  const passwordHash = await hash(password, 12);

  await connection.db.insert(users).values([
    {
      name: "Admin integración",
      email: "admin@integration.test",
      passwordHash,
      role: "administrador"
    },
    {
      name: "Docente integración",
      email: "docente@integration.test",
      passwordHash,
      role: "docente"
    },
    {
      name: "Otro docente",
      email: "otro@integration.test",
      passwordHash,
      role: "docente"
    },
    {
      name: "Estudiante integración",
      email: "estudiante@integration.test",
      passwordHash,
      role: "estudiante"
    }
  ]);

  cache = await import("../src/db/redis.js");

  if (cache.redis.status !== "ready") {
    const client = cache.redis;

    await new Promise<void>((resolveReady, reject) => {
      const ready = () => {
        client.off("error", failed);
        resolveReady();
      };

      const failed = (error: Error) => {
        client.off("ready", ready);
        reject(error);
      };

      client.once("ready", ready);
      client.once("error", failed);
    });
  }

  await cache.redis.ping();

  ({ app } = await import("../src/app.js"));
});

afterAll(async () => {
  try {
    cache?.redis.disconnect();

    if (connection) {
      await connection.pool.end();
    }

    if (createdDatabase) {
      await adminPool.query(
        `DROP DATABASE "${databaseName}" WITH (FORCE)`
      );
    }
  } finally {
    await adminPool.end();
    vi.unstubAllEnvs();
  }
});

async function login(email: string) {
  const response = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password })
    .expect(200);

  expect(response.body.user).not.toHaveProperty("passwordHash");
  expect(response.body.accessToken).toBeTruthy();

  return response.body;
}

it("integra autenticación, permisos, espacios, reservas y API keys", async () => {
  const api = request(app);
  const missingId = randomUUID();

  // Salud y rutas inexistentes.
  const health = await api.get("/api/v1/health").expect(200);
  expect(health.body.database).toBe("up");
  expect(health.body.cache).toBe("up");

  await api.get("/api/v1/no-existe").expect(404);
  await api.get("/api/v1/spaces").expect(401);

  await api.get("/api/v1/auth/me")
    .set("Authorization", "Bearer token-invalido")
    .expect(401);

  // Registro, duplicados y credenciales inválidas.
  await api.post("/api/v1/auth/register")
    .send({ email: "incorrecto" })
    .expect(400);

  const registration = {
    name: "Usuario registrado",
    email: "nuevo@integration.test",
    password
  };

  const registered = await api.post("/api/v1/auth/register")
    .send(registration)
    .expect(201);

  expect(registered.body.user.role).toBe("estudiante");
  expect(registered.body.user).not.toHaveProperty("passwordHash");

  await api.post("/api/v1/auth/register")
    .send(registration)
    .expect(409);

  await api.post("/api/v1/auth/login")
    .send({ email: registration.email, password: "incorrecta" })
    .expect(401);

  await api.post("/api/v1/auth/login")
    .send({ email: "incorrecto", password })
    .expect(400);

  const admin = await login("admin@integration.test");
  const docente = await login("docente@integration.test");
  const otro = await login("otro@integration.test");
  const estudiante = await login("estudiante@integration.test");

  const bearer = (token: string) => `Bearer ${token}`;

  await api.get("/api/v1/auth/me")
    .set("Authorization", bearer(admin.accessToken))
    .expect(200);

  // Solo el administrador crea espacios.
  const spaceInput = {
    name: "Laboratorio integración",
    building: "Edificio pruebas",
    location: "Primer nivel",
    capacity: 25,
    opensAt: "08:00",
    closesAt: "18:00"
  };

  await api.post("/api/v1/spaces")
    .set("Authorization", bearer(estudiante.accessToken))
    .send(spaceInput)
    .expect(403);

  await api.post("/api/v1/spaces")
    .set("Authorization", bearer(admin.accessToken))
    .send({ ...spaceInput, capacity: 0 })
    .expect(400);

  const created = await api.post("/api/v1/spaces")
    .set("Authorization", bearer(admin.accessToken))
    .send(spaceInput)
    .expect(201);

  const spaceId = created.body.space.id;
  expect(spaceId).toBeTruthy();

  await api.patch(`/api/v1/spaces/${spaceId}`)
    .set("Authorization", bearer(admin.accessToken))
    .send({ closesAt: "07:00" })
    .expect(400);

  await api.patch(`/api/v1/spaces/${spaceId}`)
    .set("Authorization", bearer(admin.accessToken))
    .send({ capacity: 30 })
    .expect(200);

  await api.patch(`/api/v1/spaces/${missingId}`)
    .set("Authorization", bearer(admin.accessToken))
    .send({ capacity: 30 })
    .expect(404);

  // El segundo acceso a la misma consulta debe usar caché.
  const spacesUrl =
    "/api/v1/spaces?building=Edificio%20pruebas&capacity=20";

  const first = await api.get(spacesUrl)
    .set("Authorization", bearer(docente.accessToken))
    .expect(200);

  expect(first.headers["x-cache"]).toBe("MISS");
  expect(first.body.spaces).toHaveLength(1);

  const second = await api.get(spacesUrl)
    .set("Authorization", bearer(docente.accessToken))
    .expect(200);

  expect(second.headers["x-cache"]).toBe("HIT");

  // Fecha futura independiente del año de ejecución.
  const year = new Date().getUTCFullYear() + 2;
  const date = `${year}-01-15`;

  const availabilityUrl =
    `/api/v1/spaces/${spaceId}/availability?date=${date}`;

  await api.get(
    `/api/v1/spaces/${spaceId}/availability?date=incorrecta`
  )
    .set("Authorization", bearer(docente.accessToken))
    .expect(400);

  const free = await api.get(availabilityUrl)
    .set("Authorization", bearer(docente.accessToken))
    .expect(200);

  expect(free.body.occupied).toHaveLength(0);
  expect(free.body.available).toHaveLength(1);

  const reservationInput = {
    spaceId,
    purpose: "Prueba de integración",
    startsAt: `${date}T10:00:00-06:00`,
    endsAt: `${date}T11:00:00-06:00`
  };

  await api.post("/api/v1/reservations")
    .set("Authorization", bearer(estudiante.accessToken))
    .send(reservationInput)
    .expect(403);

  await api.post("/api/v1/reservations")
    .set("Authorization", bearer(docente.accessToken))
    .send({
      ...reservationInput,
      startsAt: `${date}T07:00:00-06:00`
    })
    .expect(400);

  const reserved = await api.post("/api/v1/reservations")
    .set("Authorization", bearer(docente.accessToken))
    .send(reservationInput)
    .expect(201);

  const reservationId = reserved.body.reservation.id;

  await api.post("/api/v1/reservations")
    .set("Authorization", bearer(docente.accessToken))
    .send(reservationInput)
    .expect(409);

  const occupied = await api.get(availabilityUrl)
    .set("Authorization", bearer(docente.accessToken))
    .expect(200);

  expect(occupied.headers["x-cache"]).toBe("MISS");
  expect(occupied.body.occupied).toHaveLength(1);

  const mine = await api.get("/api/v1/reservations/me")
    .set("Authorization", bearer(docente.accessToken))
    .expect(200);

  expect(mine.body.reservations).toHaveLength(1);

  const others = await api.get("/api/v1/reservations/me")
    .set("Authorization", bearer(otro.accessToken))
    .expect(200);

  expect(others.body.reservations).toHaveLength(0);

  await api.delete(`/api/v1/reservations/${reservationId}`)
    .set("Authorization", bearer(otro.accessToken))
    .expect(403);

  await api.delete(`/api/v1/reservations/${missingId}`)
    .set("Authorization", bearer(docente.accessToken))
    .expect(404);

  await api.delete(`/api/v1/reservations/${reservationId}`)
    .set("Authorization", bearer(docente.accessToken))
    .expect(204);

  const availableAgain = await api.get(availabilityUrl)
    .set("Authorization", bearer(docente.accessToken))
    .expect(200);

  expect(availableAgain.headers["x-cache"]).toBe("MISS");
  expect(availableAgain.body.occupied).toHaveLength(0);

  // Dos solicitudes simultáneas: solo una puede reservar.
  const simultaneous = await Promise.all(
    [1, 2].map(() => api.post("/api/v1/reservations")
      .set("Authorization", bearer(docente.accessToken))
      .send({
        ...reservationInput,
        startsAt: `${date}T12:00:00-06:00`,
        endsAt: `${date}T13:00:00-06:00`
      }))
  );

  expect(
    simultaneous.map((response) => response.status).sort()
  ).toEqual([201, 409]);

  const winner = simultaneous.find(
    (response) => response.status === 201
  )!;

  await api.delete(
    `/api/v1/reservations/${winner.body.reservation.id}`
  )
    .set("Authorization", bearer(admin.accessToken))
    .expect(204);

  // API keys: permisos, consulta y revocación.
  const keyResponse = await api.post("/api/v1/api-keys")
    .set("Authorization", bearer(admin.accessToken))
    .send({
      name: "Pantalla integración",
      permissions: ["read:spaces", "read:now"]
    })
    .expect(201);

  const key = keyResponse.body.key;

  await api.get("/api/v1/spaces")
    .set("X-API-Key", key)
    .expect(200);

  await api.get("/api/v1/now?building=Edificio%20pruebas")
    .set("X-API-Key", key)
    .expect(200);

  const keyList = await api.get("/api/v1/api-keys")
    .set("Authorization", bearer(admin.accessToken))
    .expect(200);

  expect(keyList.body.apiKeys).toHaveLength(1);
  expect(keyList.body.apiKeys[0]).not.toHaveProperty("keyHash");
  expect(keyList.body.apiKeys[0]).not.toHaveProperty("key");

  const restricted = await api.post("/api/v1/api-keys")
    .set("Authorization", bearer(admin.accessToken))
    .send({
      name: "Solo espacios",
      permissions: ["read:spaces"]
    })
    .expect(201);

  await api.get("/api/v1/now")
    .set("X-API-Key", restricted.body.key)
    .expect(403);

  await api.delete(
    `/api/v1/api-keys/${keyResponse.body.apiKey.id}`
  )
    .set("Authorization", bearer(admin.accessToken))
    .expect(204);

  await api.get("/api/v1/spaces")
    .set("X-API-Key", key)
    .expect(401);

  // Eliminación lógica de espacios.
  await api.delete(`/api/v1/spaces/${spaceId}`)
    .set("Authorization", bearer(admin.accessToken))
    .expect(204);

  await api.get(availabilityUrl)
    .set("Authorization", bearer(docente.accessToken))
    .expect(404);

  // Rotación del refresh token y cierre de sesión.
  const renewed = await api.post("/api/v1/auth/refresh")
    .send({ refreshToken: admin.refreshToken })
    .expect(200);

  expect(renewed.body.refreshToken).not.toBe(admin.refreshToken);

  await api.post("/api/v1/auth/refresh")
    .send({ refreshToken: admin.refreshToken })
    .expect(401);

  await api.post("/api/v1/auth/logout")
    .set("Authorization", bearer(renewed.body.accessToken))
    .send({ refreshToken: renewed.body.refreshToken })
    .expect(204);

  await api.post("/api/v1/auth/refresh")
    .send({ refreshToken: renewed.body.refreshToken })
    .expect(401);
});