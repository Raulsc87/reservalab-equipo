# Decisiones de arquitectura

## ADR-001: Monorepo con tipos y validaciones compartidos

Estado: aceptada.

### Contexto

La API, la web y la consola intercambian los mismos datos.
Mantener contratos separados aumenta las diferencias entre clientes.

### Decisión

Usar pnpm workspaces y Turborepo.
Compartir tipos y esquemas Zod mediante `packages/shared`.

### Alternativas consideradas

- Repositorios separados: permiten entregas independientes, pero
  requieren publicar y sincronizar contratos.
- Duplicar tipos: simplifica el inicio, pero aumenta el mantenimiento.

### Consecuencias

Los cambios de contratos se coordinan dentro del mismo repositorio.
El paquete compartido debe compilarse antes que sus consumidores.

## ADR-002: PostgreSQL y Drizzle con protección de traslapes

Estado: aceptada.

### Contexto

Una comprobación de disponibilidad en código no basta cuando dos
solicitudes llegan al mismo tiempo.

### Decisión

Usar PostgreSQL con Drizzle, migraciones y una restricción de exclusión
para reservas confirmadas, además de la validación en el servicio.

Los intervalos son semiabiertos: `[inicio, fin)`.

### Alternativas consideradas

- Validar solamente en el servicio: deja una condición de carrera.
- Bloqueo administrado únicamente en la aplicación: exige coordinación
  adicional entre instancias.
- Serializar todas las reservas: reduce la concurrencia innecesariamente.

### Consecuencias

La base garantiza la integridad aun con peticiones simultáneas.
La API traduce el conflicto de exclusión a HTTP 409.
La migración depende de capacidades específicas de PostgreSQL.

## ADR-003: JWT para usuarios y API keys para consultas de sistema

Estado: aceptada.

### Contexto

Las personas necesitan roles y sesiones.
La pantalla informativa necesita consultar sin iniciar sesión
como un usuario en cada uso.

### Decisión

Utilizar JWT con refresh tokens rotativos para usuarios.
Utilizar API keys con permisos `read:spaces` y `read:now`
para consultas de sistema.

Guardar hashes de refresh tokens y API keys, no sus valores completos.

### Alternativas consideradas

- Un JWT de administrador para la pantalla: concede permisos excesivos
  y representa la identidad de una persona.
- Una clave estática en el código: dificulta revocación y rotación.
- Usar API keys para toda la aplicación: no representa adecuadamente
  las sesiones y roles de usuarios.

### Consecuencias

Cada consumidor recibe permisos explícitos.
Una API key solo se entrega completa al crearla.
El access token conserva su vigencia hasta expirar incluso
después del logout.

## ADR-004: Redis con TTL e invalidación por versión

Estado: aceptada.

### Contexto

Espacios, disponibilidad y ocupación reciben consultas repetidas.
Una mutación puede dejar respuestas almacenadas desactualizadas.

### Decisión

Almacenar resultados durante 60 segundos.
Incluir una versión global en las claves de caché y cambiarla
después de modificar espacios o reservas.

Utilizar Redis también para el contador atómico de solicitudes
por API key.

### Alternativas consideradas

- Solo TTL: permite respuestas antiguas después de una reserva.
- Borrar claves mediante búsquedas globales: añade trabajo de recorrido.
- Invalidación específica por espacio: ofrece más precisión, pero
  requiere mantener dependencias entre consultas y filtros.

### Consecuencias

La invalidación es simple y no requiere recorrer claves.
Se pueden recargar consultas no afectadas por el cambio.
Redis es una dependencia operativa y no existe un modo de
degradación completo ante su caída.

## ADR-005: Servicio externo simulado mediante Mockoon

Estado: aceptada.

### Contexto

Es necesario demostrar integración con notificaciones sin depender
de un proveedor real.

### Decisión

Enviar eventos HTTP a Mockoon al confirmar y cancelar reservas.
Aceptar HTTP 202 como confirmación del servicio.
Aplicar un tiempo límite de tres segundos y registrar fallos.

### Alternativas consideradas

- Omitir la integración: no demuestra comunicación externa.
- Usar un proveedor real: exige credenciales y disponibilidad externa.
- Agregar una cola desde el inicio: mejora entrega durable,
  pero aumenta el alcance.

### Consecuencias

La integración puede probarse localmente y observarse en logs.
Un fallo de notificación no revierte la reserva.
No se garantiza entrega eventual porque no hay reintentos durables.

## ADR-006: Web sin framework y despliegue con Compose

Estado: aceptada.

### Contexto

El proyecto requiere una web HTML y TypeScript y un arranque
reproducible de todos los servicios.

### Decisión

Construir la web con Vite y servir sus archivos mediante Nginx.
Usar un proxy `/api/` hacia Express.
Coordinar PostgreSQL, Redis, Mockoon, API y web con Docker Compose.

### Alternativas consideradas

- Framework de interfaz: no corresponde al alcance exigido.
- Servidores iniciados manualmente: aumenta diferencias entre equipos.
- Servir desarrollo con Vite en la entrega: no utiliza la compilación
  estática preparada para publicación.

### Consecuencias

El entorno completo arranca con un comando.
Nginx y la API se comunican dentro de la red de Compose.
El primer build requiere descargas y los cambios de código
requieren reconstruir las imágenes.