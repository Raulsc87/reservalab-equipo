import {
  loginSchema,
  createReservationSchema
} from "@reservalab/shared";
import type { Role } from "@reservalab/shared";

interface Session {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
}

interface Space {
  id: string;
  name: string;
  building: string;
  opensAt: string;
  closesAt: string;
}

interface Period {
  startsAt: string;
  endsAt: string;
}

interface Availability {
  space: Space;
  occupied: Period[];
  available: Period[];
}

interface Reservation extends Period {
  id: string;
  spaceId: string;
  purpose: string;
  status: "confirmada" | "cancelada";
}

interface Occupancy {
  checkedAt: string;
  spaces: {
    id: string;
    name: string;
    building: string;
    location: string;
    status: "libre" | "ocupado" | "cerrado";
    reservation: Period | null;
  }[];
}

function element<T extends HTMLElement>(id: string): T {
  const result = document.getElementById(id);

  if (!result) {
    throw new Error(`Elemento no encontrado: ${id}`);
  }

  return result as T;
}

const input = (id: string) => element<HTMLInputElement>(id);
const form = (id: string) => element<HTMLFormElement>(id);
const spaceSelect = element<HTMLSelectElement>("espacio");

// Credenciales únicamente en memoria.
let session: Session | null = null;
let apiKey = "";
let building = "";
let spaces: Space[] = [];
let timer: ReturnType<typeof setInterval> | undefined;
let refreshing: Promise<void> | null = null;
let currentScreen = "login";

function message(text: string): void {
  element("mensaje").textContent = text;
}

function stopPolling(): void {
  if (timer !== undefined) {
    clearInterval(timer);
    timer = undefined;
  }
}

function startPolling(): void {
  stopPolling();

  if (currentScreen === "pantalla" && apiKey) {
    timer = setInterval(() => {
      void loadOccupancy().catch(showError);
    }, 30000);
  }
}

function showScreen(screen: string): void {
  if (screen === "reservas" && !session) {
    screen = "login";
    message("Primero iniciá sesión.");
  }

  currentScreen = screen;

  for (const id of ["login", "reservas", "pantalla"]) {
    element(id).hidden = id !== screen;
  }

  startPolling();
}

function showError(error: unknown): void {
  message(
    error instanceof Error
      ? error.message
      : "No se pudo completar la operación."
  );
}

async function run(
  button: HTMLButtonElement,
  action: () => Promise<void>
): Promise<void> {
  button.disabled = true;
  message("");

  try {
    await action();
  } catch (error) {
    showError(error);
  } finally {
    button.disabled = false;
  }
}

async function renewSession(): Promise<void> {
  if (!session) {
    throw new Error("Iniciá sesión nuevamente.");
  }

  const previous = session;

  const response = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refreshToken: previous.refreshToken
    })
  });

  if (!response.ok) {
    session = null;
    showScreen("login");
    throw new Error("La sesión venció. Iniciá sesión nuevamente.");
  }

  const tokens = await response.json() as {
    accessToken: string;
    refreshToken: string;
  };

  if (session === previous) {
    session = {
      ...previous,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }
}

async function api<T>(
  path: string,
  options: RequestInit = {},
  system = false,
  retry = true
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (system) {
    headers.set("X-API-Key", apiKey);
  } else if (session) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  // Si hubo renovación, logout debe revocar el token nuevo.
  if (path === "/auth/logout" && session) {
    options = {
      ...options,
      body: JSON.stringify({
        refreshToken: session.refreshToken
      })
    };
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers
  });

  if (
    response.status === 401 &&
    !system &&
    session &&
    retry &&
    path !== "/auth/login"
  ) {
    if (!refreshing) {
      refreshing = renewSession().finally(() => {
        refreshing = null;
      });
    }

    await refreshing;

    return api<T>(path, options, false, false);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({
      error: "No se pudo completar la petición"
    }));

    throw new Error(data.error ?? `Error HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

const dateFormatter = new Intl.DateTimeFormat("es-GT", {
  timeZone: "America/Guatemala",
  dateStyle: "short",
  timeStyle: "short",
  hour12: false
});

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

function addItem(listId: string, text: string): HTMLLIElement {
  const item = document.createElement("li");
  item.textContent = text;
  element(listId).append(item);
  return item;
}

function showPeriods(listId: string, periods: Period[]): void {
  element(listId).replaceChildren();

  if (periods.length === 0) {
    addItem(listId, "No hay períodos.");
    return;
  }

  for (const period of periods) {
    addItem(
      listId,
      `${formatDate(period.startsAt)} — ${formatDate(period.endsAt)}`
    );
  }
}

async function loadAvailability(): Promise<void> {
  element("horario").textContent = "";
  element("libres").replaceChildren();
  element("ocupados").replaceChildren();

  if (!spaceSelect.value || !input("fecha").value) {
    return;
  }

  const data = await api<Availability>(
    `/spaces/${spaceSelect.value}/availability?date=${input("fecha").value}`
  );

  element("horario").textContent =
    `Horario: ${data.space.opensAt} a ${data.space.closesAt}`;

  showPeriods("libres", data.available);
  showPeriods("ocupados", data.occupied);
}

async function loadMyReservations(): Promise<void> {
  const data = await api<{ reservations: Reservation[] }>(
    "/reservations/me"
  );

  element("mis-reservas").replaceChildren();

  if (data.reservations.length === 0) {
    addItem("mis-reservas", "Todavía no tenés reservas.");
    return;
  }

  for (const reservation of data.reservations) {
    const space = spaces.find(
      (item) => item.id === reservation.spaceId
    );

    const item = addItem(
      "mis-reservas",
      `${space?.name ?? reservation.spaceId}: ` +
      `${formatDate(reservation.startsAt)} — ` +
      `${formatDate(reservation.endsAt)}. ` +
      `${reservation.purpose}. Estado: ${reservation.status}.`
    );

    if (reservation.status === "confirmada") {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Cancelar";

      button.addEventListener("click", () => {
        if (!window.confirm("¿Cancelar esta reserva?")) {
          return;
        }

        void run(button, async () => {
          await api<void>(
            `/reservations/${reservation.id}`,
            { method: "DELETE" }
          );

          await Promise.all([
            loadMyReservations(),
            loadAvailability()
          ]);

          message("Reserva cancelada.");
        });
      });

      item.append(button);
    }
  }
}

async function openReservations(): Promise<void> {
  if (!session) {
    showScreen("login");
    message("Primero iniciá sesión.");
    return;
  }

  showScreen("reservas");

  element("usuario").textContent =
    `${session.user.name} · ${session.user.role}`;

  const canReserve =
    session.user.role === "administrador" ||
    session.user.role === "docente";

  element("crear-reserva").hidden = !canReserve;
  element("solo-consulta").hidden = canReserve;

  const data = await api<{ spaces: Space[] }>("/spaces");
  spaces = data.spaces;

  const previousId = spaceSelect.value;
  spaceSelect.replaceChildren();

  for (const space of spaces) {
    const option = document.createElement("option");
    option.value = space.id;
    option.textContent = `${space.name} · ${space.building}`;
    spaceSelect.append(option);
  }

  if (spaces.some((space) => space.id === previousId)) {
    spaceSelect.value = previousId;
  }

  await Promise.all([
    loadAvailability(),
    loadMyReservations()
  ]);

  if (spaces.length === 0) {
    message("No hay espacios activos disponibles.");
  }
}

async function loadOccupancy(): Promise<void> {
  if (!apiKey) {
    throw new Error("Ingresá una API key.");
  }

  const query = building
    ? `?building=${encodeURIComponent(building)}`
    : "";

  const data = await api<Occupancy>(
    `/now${query}`,
    {},
    true
  );

  element("ocupacion").replaceChildren();

  for (const space of data.spaces) {
    const row = document.createElement("tr");

    const values = [
      space.name,
      space.building,
      space.location,
      space.status,
      space.reservation
        ? `${formatDate(space.reservation.startsAt)} — ` +
          formatDate(space.reservation.endsAt)
        : "Sin reserva actual"
    ];

    values.forEach((value, index) => {
      const cell = document.createElement("td");
      cell.textContent = value;

      if (index === 3) {
        cell.className = `estado-${space.status}`;
      }

      row.append(cell);
    });

    element("ocupacion").append(row);
  }

  element("ultima-actualizacion").textContent =
    `Datos consultados: ${formatDate(data.checkedAt)}. ` +
    `Actualización automática cada 30 segundos. ` +
    `${data.spaces.length} espacios.`;
}

input("fecha").value = new Date(
  Date.now() - 6 * 60 * 60 * 1000
).toISOString().slice(0, 10);

element("nav-login").addEventListener("click", () => {
  message("");
  showScreen("login");
});

element("nav-reservas").addEventListener("click", () => {
  void run(
    element<HTMLButtonElement>("nav-reservas"),
    openReservations
  );
});

element("nav-pantalla").addEventListener("click", () => {
  message("");
  showScreen("pantalla");

  if (apiKey) {
    void loadOccupancy().catch(showError);
  }
});

form("form-login").addEventListener("submit", (event) => {
  event.preventDefault();

  const button = form("form-login")
    .querySelector<HTMLButtonElement>("button")!;

  void run(button, async () => {
    const result = loginSchema.safeParse({
      email: input("email").value.trim(),
      password: input("password").value
    });

    if (!result.success) {
      throw new Error("Revisá el correo y la contraseña.");
    }

    session = await api<Session>("/auth/login", {
      method: "POST",
      body: JSON.stringify(result.data)
    });

    input("password").value = "";
    await openReservations();
  });
});

form("form-disponibilidad").addEventListener("submit", (event) => {
  event.preventDefault();

  const button = form("form-disponibilidad")
    .querySelector<HTMLButtonElement>("button")!;

  void run(button, loadAvailability);
});

form("form-reserva").addEventListener("submit", (event) => {
  event.preventDefault();

  const button = form("form-reserva")
    .querySelector<HTMLButtonElement>("button")!;

  void run(button, async () => {
    const date = input("fecha").value;

    const result = createReservationSchema.safeParse({
      spaceId: spaceSelect.value,
      purpose: input("proposito").value,
      startsAt: `${date}T${input("inicio").value}:00-06:00`,
      endsAt: `${date}T${input("fin").value}:00-06:00`
    });

    if (!result.success) {
      throw new Error(
        "Seleccioná espacio y fecha, un motivo y horas válidas. " +
        "El fin debe ser posterior al inicio."
      );
    }

    await api("/reservations", {
      method: "POST",
      body: JSON.stringify(result.data)
    });

    form("form-reserva").reset();

    await Promise.all([
      loadAvailability(),
      loadMyReservations()
    ]);

    message("Reserva creada correctamente.");
  });
});

element("actualizar-reservas").addEventListener("click", () => {
  void run(
    element<HTMLButtonElement>("actualizar-reservas"),
    loadMyReservations
  );
});

element("logout").addEventListener("click", () => {
  void run(element<HTMLButtonElement>("logout"), async () => {
    await api<void>("/auth/logout", {
      method: "POST"
    });

    session = null;
    spaces = [];
    spaceSelect.replaceChildren();
    element("usuario").textContent = "";
    element("mis-reservas").replaceChildren();
    element("libres").replaceChildren();
    element("ocupados").replaceChildren();

    showScreen("login");
    message("Sesión cerrada.");
  });
});

form("form-pantalla").addEventListener("submit", (event) => {
  event.preventDefault();

  const button = form("form-pantalla")
    .querySelector<HTMLButtonElement>("button")!;

  void run(button, async () => {
    stopPolling();
    apiKey = input("api-key").value.trim();
    building = input("edificio").value.trim();

    await loadOccupancy();
    startPolling();
    message("Pantalla conectada.");
  });
});

element("desconectar").addEventListener("click", () => {
  stopPolling();
  apiKey = "";
  input("api-key").value = "";
  element("ocupacion").replaceChildren();
  element("ultima-actualizacion").textContent = "";
  message("Pantalla desconectada.");
});