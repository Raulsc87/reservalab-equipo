import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  loginSchema,
  createSpaceSchema,
  createApiKeySchema
} from "@reservalab/shared";
import type {
  Role,
  ApiKeyPermission
} from "@reservalab/shared";

interface Session {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    role: Role;
  };
}

const terminal = createInterface({
  input: stdin,
  output: stdout
});

const baseUrl = (
  process.env.API_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

let session: Session | null = null;

async function ask(
  label: string,
  defaultValue?: string
): Promise<string> {
  const hint = defaultValue === undefined
    ? ""
    : ` [${defaultValue}]`;

  const answer = (
    await terminal.question(`${label}${hint}: `)
  ).trim();

  return answer || defaultValue || "";
}

async function request<T>(
  path: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json"
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (session) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined
      ? undefined
      : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000)
  });

  if (!response.ok) {
    const result = await response.json().catch(() => null) as {
      error?: string;
    } | null;

    throw new Error(
      result?.error ?? `La API respondió HTTP ${response.status}`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return await response.json() as T;
}

async function login(): Promise<void> {
  console.log("\nInicio de sesión de administrador");
  console.log(
    "La contraseña escrita en esta consola será visible."
  );

  const email = await ask(
    "Correo",
    "admin@reservalab.test"
  );

  const password = process.env.RESERVALAB_PASSWORD ??
    await terminal.question("Contraseña: ");

  const parsed = loginSchema.safeParse({
    email,
    password
  });

  if (!parsed.success) {
    throw new Error("El correo o la contraseña no son válidos.");
  }

  session = await request<Session>(
    "/auth/login",
    "POST",
    parsed.data
  );

  if (session.user.role !== "administrador") {
    throw new Error(
      "Esta consola requiere una cuenta de administrador."
    );
  }

  console.log(`\nBienvenido, ${session.user.name}.`);
}

async function createSpace(): Promise<void> {
  console.log("\nCrear espacio");

  const name = await ask("Nombre");
  const description = await ask("Descripción opcional");
  const building = await ask("Edificio");
  const location = await ask("Ubicación");
  const capacityText = await ask("Capacidad");
  const opensAt = await ask("Apertura HH:mm", "07:00");
  const closesAt = await ask("Cierre HH:mm", "22:00");

  const parsed = createSpaceSchema.safeParse({
    name,
    description: description || undefined,
    building,
    location,
    capacity: Number(capacityText),
    opensAt,
    closesAt
  });

  if (!parsed.success) {
    console.error("\nRevisá estos campos:");

    for (const issue of parsed.error.issues) {
      console.error(
        `- ${issue.path.join(".")}: ${issue.message}`
      );
    }

    return;
  }

  const result = await request<{
    message: string;
    space: {
      id: string;
      name: string;
      building: string;
      capacity: number;
      opensAt: string;
      closesAt: string;
    };
  }>("/spaces", "POST", parsed.data);

  console.log(`\n${result.message}`);

  console.table([{
    ID: result.space.id,
    Nombre: result.space.name,
    Edificio: result.space.building,
    Capacidad: result.space.capacity,
    Apertura: result.space.opensAt,
    Cierre: result.space.closesAt
  }]);
}

async function createKey(): Promise<void> {
  console.log("\nGenerar API key");

  const name = await ask("Nombre de la clave");

  console.log("\nPermisos:");
  console.log("1. Consultar espacios");
  console.log("2. Consultar ocupación actual");
  console.log("3. Ambos permisos");

  const choice = await ask("Elegí una opción", "2");

  const permissionsByChoice: Record<
    string,
    ApiKeyPermission[]
  > = {
    "1": ["read:spaces"],
    "2": ["read:now"],
    "3": ["read:spaces", "read:now"]
  };

  const permissions = permissionsByChoice[choice];

  if (!permissions) {
    console.log("Opción de permisos no válida.");
    return;
  }

  const parsed = createApiKeySchema.safeParse({
    name,
    permissions
  });

  if (!parsed.success) {
    console.error("\nDatos no válidos:");

    for (const issue of parsed.error.issues) {
      console.error(
        `- ${issue.path.join(".")}: ${issue.message}`
      );
    }

    return;
  }

  const result = await request<{ key: string }>(
    "/api-keys",
    "POST",
    parsed.data
  );

  console.log("\nAPI key creada correctamente.");
  console.log("Copiala ahora: solo se entrega al crearla.\n");
  console.log(result.key);
  console.log();
}

async function logout(): Promise<void> {
  if (!session) {
    return;
  }

  try {
    await request<void>(
      "/auth/logout",
      "POST",
      { refreshToken: session.refreshToken }
    );
  } catch {
    console.error(
      "No se pudo cerrar la sesión en la API."
    );
  } finally {
    session = null;
  }
}

async function main(): Promise<void> {
  console.log("==================================");
  console.log(" ReservaLab | Consola administrativa");
  console.log("==================================");

  await login();

  while (true) {
    console.log("\n1. Crear espacio");
    console.log("2. Generar API key");
    console.log("0. Salir");

    const option = await ask("Opción");

    if (option === "0") {
      break;
    }

    try {
      if (option === "1") {
        await createSpace();
      } else if (option === "2") {
        await createKey();
      } else {
        console.log("Elegí 1, 2 o 0.");
      }
    } catch (error) {
      console.error(
        "\nError:",
        error instanceof Error
          ? error.message
          : "No se pudo completar la operación."
      );
    }
  }
}

try {
  await main();
} catch (error) {
  console.error(
    "\nError:",
    error instanceof Error
      ? error.message
      : "No se pudo iniciar la consola."
  );

  process.exitCode = 1;
} finally {
  await logout();
  terminal.close();
}