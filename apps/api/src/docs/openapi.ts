type Schema = Record<string, unknown>;

const ref = (name: string): Schema => ({
  $ref: `#/components/schemas/${name}`
});

const text = { type: "string" };
const uuid = { type: "string", format: "uuid" };
const timestamp = { type: "string", format: "date-time" };
const hour = {
  type: "string",
  pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
  example: "08:00"
};

const array = (items: Schema): Schema => ({
  type: "array",
  items
});

function object(
  properties: Record<string, unknown>,
  required: string[] = []
): Schema {
  return {
    type: "object",
    properties,
    required
  };
}

function body(name: string) {
  return {
    required: true,
    content: {
      "application/json": {
        schema: ref(name)
      }
    }
  };
}

function response(schema: Schema, description = "Operación correcta") {
  return {
    description,
    content: {
      "application/json": { schema }
    }
  };
}

const error = (description: string) =>
  response(ref("Error"), description);

const errors = {
  "400": error("Datos o parámetros inválidos"),
  "401": error("Credencial ausente, inválida, vencida o revocada"),
  "403": error("Rol o permiso insuficiente"),
  "404": error("Recurso no encontrado"),
  "409": error("Correo duplicado o conflicto de reservas"),
  "429": {
    ...error("Límite de 60 solicitudes por minuto alcanzado"),
    headers: {
      "Retry-After": {
        description: "Segundos que se debe esperar",
        schema: { type: "integer" }
      }
    }
  },
  "500": error("No se pudo completar la operación"),
  "503": error("Servicio necesario no disponible")
};

function failures(...codes: Array<keyof typeof errors>) {
  return Object.fromEntries(
    codes.map((code) => [code, errors[code]])
  );
}

const idParameter = {
  name: "id",
  in: "path",
  required: true,
  schema: uuid
};

const buildingParameter = {
  name: "building",
  in: "query",
  required: false,
  description: "Nombre exacto del edificio",
  schema: {
    type: "string",
    minLength: 1,
    maxLength: 100
  }
};

const userOrKey = [
  { bearerAuth: [] },
  { apiKeyAuth: [] }
];

const cacheHeaders = {
  "X-Cache": {
    description: "Resultado del acceso a caché; duración de 60 segundos",
    schema: {
      type: "string",
      enum: ["HIT", "MISS"]
    }
  }
};

const spaceProperties = {
  name: { type: "string", minLength: 2, maxLength: 100 },
  description: {
    type: "string",
    maxLength: 2000,
    nullable: true
  },
  building: { type: "string", minLength: 1, maxLength: 100 },
  location: { type: "string", minLength: 2, maxLength: 150 },
  capacity: {
    type: "integer",
    minimum: 1,
    maximum: 2147483647
  },
  opensAt: hour,
  closesAt: hour,
  active: { type: "boolean" }
};

const wrapped = (field: string, schema: string) =>
  object({
    message: text,
    [field]: ref(schema)
  });

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "ReservaLab API",
    version: "1.0.0",
    description: [
      "API de reservas de laboratorios y salones.",
      "Los horarios de los espacios corresponden a America/Guatemala.",
      "Los instantes de reservas se envían con zona horaria.",
      "El acceso JWT dura 15 minutos y el refresh token dura 7 días.",
      "Las API keys se envían mediante X-API-Key y tienen permisos específicos.",
      "Solo el administrador gestiona espacios y API keys.",
      "Docentes y administradores pueden crear reservas.",
      "Las reservas confirmadas no pueden traslaparse."
    ].join("\n\n")
  },
  servers: [
    { url: "/api/v1", description: "API del servidor actual" }
  ],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "Salud" },
    { name: "Autenticación" },
    { name: "Espacios" },
    { name: "Reservas" },
    { name: "API keys" },
    { name: "Ocupación" }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Ingresá únicamente el accessToken del login."
      },
      apiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
        description: "Clave completa entregada al crearla."
      }
    },
    schemas: {
      Error: object({
        error: text,
        details: {
          type: "array",
          items: { type: "object" }
        }
      }, ["error"]),

      User: object({
        id: uuid,
        name: text,
        email: { type: "string", format: "email" },
        role: {
          type: "string",
          enum: ["administrador", "docente", "estudiante"]
        }
      }, ["id", "name", "email", "role"]),

      RegisterInput: {
        ...object({
          name: { type: "string", minLength: 2, maxLength: 100 },
          email: {
            type: "string",
            format: "email",
            maxLength: 254
          },
          password: {
            type: "string",
            format: "password",
            minLength: 8,
            maxLength: 128,
            description: "Máximo efectivo de 72 bytes UTF-8"
          }
        }, ["name", "email", "password"]),
        additionalProperties: false
      },

      LoginInput: {
        ...object({
          email: {
            type: "string",
            format: "email",
            maxLength: 254
          },
          password: {
            type: "string",
            format: "password",
            minLength: 1,
            maxLength: 128
          }
        }, ["email", "password"]),
        additionalProperties: false
      },

      RefreshInput: {
        ...object({
          refreshToken: {
            type: "string",
            pattern: "^[a-f0-9]{64}$"
          }
        }, ["refreshToken"]),
        additionalProperties: false
      },

      Session: object({
        message: text,
        accessToken: text,
        refreshToken: text,
        tokenType: { type: "string", enum: ["Bearer"] },
        expiresIn: { type: "integer", example: 900 },
        refreshExpiresAt: timestamp,
        user: ref("User")
      }, ["accessToken", "refreshToken", "user"]),

      Health: object({
        status: { type: "string", enum: ["ok", "error"] },
        service: { type: "string", enum: ["reservalab-api"] },
        database: { type: "string", enum: ["up", "down"] },
        cache: { type: "string", enum: ["up", "down"] }
      }, ["status", "service", "database", "cache"]),

      CreateSpaceInput: {
        ...object(spaceProperties, [
          "name", "building", "location", "capacity"
        ]),
        additionalProperties: false,
        description:
          "Cierre posterior a apertura. Por defecto: 07:00 a 22:00."
      },

      UpdateSpaceInput: {
        ...object(spaceProperties),
        minProperties: 1,
        additionalProperties: false,
        description:
          "Enviar al menos un campo. Se valida contra el horario guardado."
      },

      Space: object({
        ...spaceProperties,
        id: uuid,
        opensAt: { type: "string", example: "08:00:00" },
        closesAt: { type: "string", example: "18:00:00" },
        createdAt: timestamp,
        updatedAt: timestamp
      }),

      Period: object({
        startsAt: timestamp,
        endsAt: timestamp
      }, ["startsAt", "endsAt"]),

      Availability: object({
        date: { type: "string", format: "date" },
        timezone: {
          type: "string",
          enum: ["America/Guatemala"]
        },
        space: object({
          id: uuid,
          name: text,
          opensAt: text,
          closesAt: text
        }),
        occupied: array(ref("Period")),
        available: array(ref("Period"))
      }),

      CreateReservationInput: {
        ...object({
          spaceId: uuid,
          purpose: {
            type: "string",
            minLength: 2,
            maxLength: 250
          },
          startsAt: {
            ...timestamp,
            example: "2030-01-15T10:00:00-06:00"
          },
          endsAt: {
            ...timestamp,
            example: "2030-01-15T11:00:00-06:00"
          }
        }, ["spaceId", "purpose", "startsAt", "endsAt"]),
        additionalProperties: false,
        description:
          "Inicio futuro, fin posterior al inicio y período dentro del horario del espacio."
      },

      Reservation: object({
        id: uuid,
        userId: uuid,
        spaceId: uuid,
        purpose: text,
        startsAt: timestamp,
        endsAt: timestamp,
        status: {
          type: "string",
          enum: ["confirmada", "cancelada"]
        },
        createdAt: timestamp,
        updatedAt: timestamp
      }),

      CreateApiKeyInput: {
        ...object({
          name: { type: "string", minLength: 2, maxLength: 100 },
          permissions: {
            type: "array",
            minItems: 1,
            maxItems: 2,
            items: {
              type: "string",
              enum: ["read:spaces", "read:now"]
            }
          },
          expiresAt: {
            ...timestamp,
            nullable: true,
            description: "Fecha futura; null u omitida para no vencer."
          }
        }, ["name", "permissions"]),
        additionalProperties: false
      },

      ApiKey: object({
        id: uuid,
        userId: uuid,
        name: text,
        prefix: text,
        permissions: array({
          type: "string",
          enum: ["read:spaces", "read:now"]
        }),
        lastUsedAt: { ...timestamp, nullable: true },
        expiresAt: { ...timestamp, nullable: true },
        revokedAt: { ...timestamp, nullable: true },
        createdAt: timestamp
      }),

      Occupancy: object({
        checkedAt: timestamp,
        timezone: {
          type: "string",
          enum: ["America/Guatemala"]
        },
        spaces: array(object({
          id: uuid,
          name: text,
          building: text,
          location: text,
          capacity: { type: "integer" },
          opensAt: text,
          closesAt: text,
          status: {
            type: "string",
            enum: ["libre", "ocupado", "cerrado"]
          },
          reservation: {
            type: "object",
            nullable: true,
            properties: {
              startsAt: timestamp,
              endsAt: timestamp
            }
          }
        }))
      })
    }
  },

  paths: {
    "/health": {
      get: {
        tags: ["Salud"],
        summary: "Comprobar API, PostgreSQL y Redis",
        security: [],
        responses: {
          "200": response(ref("Health")),
          "503": response(ref("Health"), "Algún servicio no responde")
        }
      }
    },

    "/auth/register": {
      post: {
        tags: ["Autenticación"],
        summary: "Registrar un estudiante",
        security: [],
        requestBody: body("RegisterInput"),
        responses: {
          "201": response(wrapped("user", "User")),
          ...failures("400", "409", "500")
        }
      }
    },

    "/auth/login": {
      post: {
        tags: ["Autenticación"],
        summary: "Iniciar sesión",
        security: [],
        requestBody: body("LoginInput"),
        responses: {
          "200": response(ref("Session")),
          ...failures("400", "401", "500")
        }
      }
    },

    "/auth/refresh": {
      post: {
        tags: ["Autenticación"],
        summary: "Rotar refresh token y renovar sesión",
        description:
          "El refresh token anterior deja de ser válido después de utilizarlo.",
        security: [],
        requestBody: body("RefreshInput"),
        responses: {
          "200": response(ref("Session")),
          ...failures("400", "401", "500")
        }
      }
    },

    "/auth/logout": {
      post: {
        tags: ["Autenticación"],
        summary: "Revocar el refresh token",
        description:
          "Requiere accessToken. El accessToken emitido vence por su duración normal.",
        requestBody: body("RefreshInput"),
        responses: {
          "204": { description: "Refresh token revocado; sin cuerpo" },
          ...failures("400", "401", "500")
        }
      }
    },

    "/auth/me": {
      get: {
        tags: ["Autenticación"],
        summary: "Consultar el usuario autenticado",
        responses: {
          "200": response(object({ user: ref("User") })),
          ...failures("401")
        }
      }
    },

    "/spaces": {
      get: {
        tags: ["Espacios"],
        summary: "Listar espacios activos",
        description: "JWT o API key con read:spaces.",
        security: userOrKey,
        parameters: [
          buildingParameter,
          {
            name: "capacity",
            in: "query",
            description: "Capacidad mínima",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 2147483647
            }
          }
        ],
        responses: {
          "200": {
            ...response(object({ spaces: array(ref("Space")) })),
            headers: cacheHeaders
          },
          ...failures("400", "401", "403", "429", "500", "503")
        }
      },
      post: {
        tags: ["Espacios"],
        summary: "Crear espacio — administrador",
        requestBody: body("CreateSpaceInput"),
        responses: {
          "201": response(wrapped("space", "Space")),
          ...failures("400", "401", "403", "500")
        }
      }
    },

    "/spaces/{id}": {
      parameters: [idParameter],
      patch: {
        tags: ["Espacios"],
        summary: "Actualizar espacio — administrador",
        requestBody: body("UpdateSpaceInput"),
        responses: {
          "200": response(wrapped("space", "Space")),
          ...failures("400", "401", "403", "404", "500")
        }
      },
      delete: {
        tags: ["Espacios"],
        summary: "Desactivar espacio — administrador",
        responses: {
          "204": { description: "Espacio desactivado; sin cuerpo" },
          ...failures("400", "401", "403", "404", "500")
        }
      }
    },

    "/spaces/{id}/availability": {
      get: {
        tags: ["Espacios"],
        summary: "Consultar períodos libres y ocupados",
        description: "JWT o API key con read:spaces.",
        security: userOrKey,
        parameters: [
          idParameter,
          {
            name: "date",
            in: "query",
            required: true,
            schema: {
              type: "string",
              format: "date",
              example: "2030-01-15"
            }
          }
        ],
        responses: {
          "200": {
            ...response(ref("Availability")),
            headers: cacheHeaders
          },
          ...failures("400", "401", "403", "404", "429", "500", "503")
        }
      }
    },

    "/reservations": {
      post: {
        tags: ["Reservas"],
        summary: "Reservar — docente o administrador",
        description:
          "La validación del servicio y una restricción de PostgreSQL impiden traslapes, incluso con solicitudes simultáneas.",
        requestBody: body("CreateReservationInput"),
        responses: {
          "201": response(wrapped("reservation", "Reservation")),
          ...failures("400", "401", "403", "404", "409", "500")
        }
      }
    },

    "/reservations/me": {
      get: {
        tags: ["Reservas"],
        summary: "Listar mis reservas, incluidas las canceladas",
        responses: {
          "200": response(object({
            reservations: array(ref("Reservation"))
          })),
          ...failures("401", "500")
        }
      }
    },

    "/reservations/{id}": {
      delete: {
        tags: ["Reservas"],
        summary: "Cancelar reserva — propietario o administrador",
        description:
          "Cancelar nuevamente una reserva propia ya cancelada también devuelve 204.",
        parameters: [idParameter],
        responses: {
          "204": { description: "Reserva cancelada; sin cuerpo" },
          ...failures("400", "401", "403", "404", "500")
        }
      }
    },

    "/api-keys": {
      post: {
        tags: ["API keys"],
        summary: "Crear API key — administrador",
        description:
          "La clave completa se entrega una sola vez. Se guarda su hash.",
        requestBody: body("CreateApiKeyInput"),
        responses: {
          "201": response(object({
            message: text,
            key: {
              type: "string",
              description: "Copiar y guardar al recibirla."
            },
            apiKey: ref("ApiKey")
          })),
          ...failures("400", "401", "403", "500")
        }
      },
      get: {
        tags: ["API keys"],
        summary: "Listar metadatos de API keys — administrador",
        description: "No devuelve las claves completas ni sus hashes.",
        responses: {
          "200": response(object({
            apiKeys: array(ref("ApiKey"))
          })),
          ...failures("401", "403", "500")
        }
      }
    },

    "/api-keys/{id}": {
      delete: {
        tags: ["API keys"],
        summary: "Revocar API key — administrador",
        parameters: [idParameter],
        responses: {
          "204": { description: "Clave revocada; sin cuerpo" },
          ...failures("400", "401", "403", "404", "500")
        }
      }
    },

    "/now": {
      get: {
        tags: ["Ocupación"],
        summary: "Consultar ocupación actual",
        description:
          "Requiere API key con read:now. La pantalla web consulta cada 30 segundos y la API usa caché de 60 segundos.",
        security: [{ apiKeyAuth: [] }],
        parameters: [buildingParameter],
        responses: {
          "200": {
            ...response(ref("Occupancy")),
            headers: cacheHeaders
          },
          ...failures("400", "401", "403", "429", "500", "503")
        }
      }
    }
  }
};