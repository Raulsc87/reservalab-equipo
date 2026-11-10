# ReservaLab

Sistema de reservas de laboratorios y salones para el proyecto de
Arquitectura de Sistemas I.

Incluye una API REST, una interfaz web y una consola administrativa.

## Tecnologías

- TypeScript y Express.
- PostgreSQL y Drizzle ORM.
- Redis para caché y límite de solicitudes.
- JWT y refresh tokens.
- HTML, CSS y TypeScript con Vite.
- Consola administrativa en Node.js.
- Mockoon para simular notificaciones externas.
- pnpm y Turborepo.
- Docker Compose.
- Vitest y Supertest.
- OpenAPI y Swagger UI.

## Organización

| Ruta | Responsabilidad |
|---|---|
| apps/api | API, lógica de negocio, persistencia y pruebas |
| apps/web | Inicio de sesión, reservas y pantalla informativa |
| apps/cli | Creación de espacios y emisión de API keys |
| packages/shared | Tipos y validaciones compartidas |
| mocks | Servicio externo simulado con Mockoon |
| docs | Arquitectura, diagramas y decisiones |

## Inicio con Docker

Requisito: Docker Desktop iniciado con contenedores Linux.

Para una instalación nueva, desde PowerShell en la raíz:

```powershell
Copy-Item .env.example .env

$jwtSecret = -join (1..3 | ForEach-Object {
    [guid]::NewGuid().ToString("N")
})

(Get-Content .env -Raw).Replace(
    "GENERAR_JWT_LOCAL",
    $jwtSecret
) | Set-Content .env -Encoding ascii

docker compose up -d --build --wait
```

Si ya existe un `.env` configurado, conservarlo y ejecutar solamente:

```powershell
docker compose up -d --build --wait
```

La primera construcción requiere conexión a Internet y puede tardar
varios minutos.

La API aplica las migraciones pendientes y ejecuta un seed idempotente
antes de iniciar. El seed no duplica los usuarios ni los espacios base.

## Direcciones

| Componente | Dirección |
|---|---|
| Web | http://localhost:5173 |
| API | http://localhost:3000/api/v1 |
| Swagger | http://localhost:3000/docs |
| OpenAPI JSON | http://localhost:3000/openapi.json |
| Salud | http://localhost:3000/api/v1/health |
| Mockoon | http://localhost:3002/health |
| PostgreSQL desde el equipo | localhost:5433 |
| Redis desde el equipo | localhost:6380 |

La web publicada por Nginx envía las solicitudes `/api/` al contenedor
de la API. El navegador no necesita conocer los nombres internos
de los contenedores.

## Usuarios de prueba

Contraseña de las tres cuentas: `ReservaLab2026!`

| Correo | Rol |
|---|---|
| admin@reservalab.test | administrador |
| docente@reservalab.test | docente |
| estudiante@reservalab.test | estudiante |

Son credenciales de demostración local.

## Uso de la web

1. Iniciar sesión.
2. Entrar en Reservas.
3. Seleccionar un espacio y una fecha.
4. Consultar períodos libres y ocupados.
5. Como docente o administrador, ingresar motivo y horario.
6. Crear la reserva.
7. Consultarla en Mis reservas y cancelarla cuando corresponda.

Los estudiantes pueden consultar disponibilidad y sus reservas,
pero no crear reservas.

La pantalla informativa utiliza una API key con permiso `read:now`,
permite filtrar por edificio y consulta automáticamente cada
30 segundos.

Los tokens y la API key se conservan en memoria de la página.
Al recargarla deben ingresarse nuevamente.

## Consola administrativa

Requisitos adicionales: Node.js 24 o superior y pnpm 12.14.0.

Con Docker corriendo:

```powershell
pnpm install
pnpm --filter @reservalab/shared build
pnpm --filter @reservalab/cli build
pnpm --filter @reservalab/cli start
```

Permite:

- Iniciar sesión como administrador.
- Crear espacios.
- Emitir API keys con permisos seleccionados.

Las horas se ingresan con dos dígitos: `08:00`, no `8:00`.
La contraseña introducida en la consola es visible.

## Autenticación y permisos

Las cuentas utilizan contraseñas con hash bcrypt.

El access token JWT dura 15 minutos. El refresh token dura 7 días,
se almacena mediante hash y se rota al renovar la sesión.

Cerrar sesión revoca el refresh token. El access token ya emitido
conserva su vencimiento normal.

Las API keys:

- Se envían en el encabezado `X-API-Key`.
- Se muestran completas únicamente al crearlas.
- Se almacenan mediante hash SHA-256.
- Admiten `read:spaces` y `read:now`.
- Pueden tener vencimiento y ser revocadas.
- Tienen un límite de 60 solicitudes por minuto por clave.

## Reservas y horarios

Los horarios de apertura y cierre corresponden a
`America/Guatemala`.

Los instantes de reserva incluyen zona horaria. Por ejemplo:

```text
2030-01-15T10:00:00-06:00
```

La API rechaza:

- Fechas o períodos inválidos.
- Reservas que comiencen en el pasado.
- Reservas fuera del horario del espacio.
- Traslapes con reservas confirmadas.

PostgreSQL tiene una restricción de exclusión para impedir
traslapes incluso con solicitudes simultáneas.

Los intervalos son semiabiertos: una reserva puede comenzar
exactamente cuando termina otra.

## Caché y notificaciones

Las consultas de espacios, disponibilidad y ocupación utilizan
Redis con una duración de 60 segundos.

El encabezado `X-Cache` indica `HIT` o `MISS`.

Crear, modificar o desactivar espacios, así como crear o cancelar
reservas, invalida la caché mediante un cambio de versión global.

Al crear o cancelar una reserva, la API envía a Mockoon:

- `reservation.confirmed`
- `reservation.cancelled`

El servicio simulado responde HTTP 202.
Un fallo de notificación no revierte la reserva.
Esta versión no implementa una cola de reintentos.

## Pruebas

Con PostgreSQL, Redis y Mockoon disponibles:

```powershell
pnpm install
pnpm --filter @reservalab/shared build
pnpm --filter @reservalab/api test:coverage
```

Las pruebas de integración crean una base de datos temporal con nombre
`reservalab_test_...`, aplican migraciones y la eliminan al finalizar.
La cuenta de PostgreSQL debe tener permiso para crear bases de datos.

La suite comprueba servicios con mocks y un recorrido HTTP completo,
incluidos permisos, conflictos, solicitudes simultáneas, rotación
de refresh tokens, API keys e invalidación de caché.

La configuración exige al menos 70 % de cobertura en líneas,
sentencias, funciones y ramas.

El reporte HTML se genera en:

```text
apps/api/coverage/index.html
```

Las pruebas originales del middleware de roles también pueden ejecutarse:

```powershell
pnpm --filter @reservalab/api exec tsx --test tests/roles.middleware.test.ts
```

Para compilar todos los paquetes:

```powershell
pnpm build
```

## Operación

Consultar servicios:

```powershell
docker compose ps
```

Consultar logs de la API:

```powershell
docker compose logs --tail=100 api
```

Consultar notificaciones:

```powershell
docker compose logs --tail=100 mockoon
```

Detener conservando la base de datos:

```powershell
docker compose down
```

Volver a iniciar:

```powershell
docker compose up -d --wait
```

Después de modificar el código:

```powershell
docker compose up -d --build --wait
```

`docker compose down -v` elimina el volumen de PostgreSQL y sus datos.

## Documentación de arquitectura

- [Arquitectura y diagramas](docs/arquitectura.md)
- [Decisiones de arquitectura](docs/decisiones.md)

## Participación del equipo

- **Raúl:** API y base de datos.
- **Diego:** interfaz web y consola administrativa.
- **Denilson:** pruebas, componentes compartidos, infraestructura,
  configuración, documentación y mocks.

## Uso de inteligencia artificial

Se utilizó ChatGPT como apoyo para proponer estructura, redactar
código y pruebas, explicar errores y preparar documentación.

Las propuestas se incorporaron y comprobaron mediante compilación,
pruebas automatizadas y pruebas manuales del sistema.
El equipo debe comprender y poder explicar el código entregado.
