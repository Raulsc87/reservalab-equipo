import { z } from "zod";

export const roleSchema = z.enum([
  "administrador",
  "docente",
  "estudiante"
]);

export const registerSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  password: z.string().min(8).max(128)
});

export const loginSchema = z.strictObject({
  email: z.email().max(254),
  password: z.string().min(1).max(128)
});

export const refreshSchema = z.strictObject({
  refreshToken: z.string().regex(/^[a-f0-9]{64}$/)
});

export type Role = z.infer<typeof roleSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export interface HealthResponse {
  status: "ok" | "error";
  service: "reservalab-api";
  database: "not_configured" | "up" | "down";
  cache: "not_configured" | "up" | "down";
}

export const spaceIdSchema = z.uuid();

export const createSpaceSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(2000).nullable().optional(),
  building: z.string().trim().min(1).max(100),
  location: z.string().trim().min(2).max(150),
  capacity: z.number().int().min(1).max(2147483647),
  opensAt: z.string()
    .regex(
      /^([01]\d|2[0-3]):[0-5]\d$/,
      "La hora de apertura debe tener formato HH:mm"
    )
    .optional(),
  closesAt: z.string()
    .regex(
      /^([01]\d|2[0-3]):[0-5]\d$/,
      "La hora de cierre debe tener formato HH:mm"
    )
    .optional(),
  active: z.boolean().optional()
});

export const updateSpaceSchema = createSpaceSchema
  .partial()
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    {
      message: "Debes enviar al menos un campo para actualizar"
    }
  );

export const listSpacesQuerySchema = z.strictObject({
  building: z.string().trim().min(1).max(100).optional(),
  capacity: z.coerce.number().int().min(1).max(2147483647).optional()
});

export const availabilityQuerySchema = z.strictObject({
  date: z.iso.date()
});

export const nowQuerySchema = z.strictObject({
  building: z.string().trim().min(1).max(100).optional()
});

export type CreateSpaceInput = z.infer<typeof createSpaceSchema>;
export type UpdateSpaceInput = z.infer<typeof updateSpaceSchema>;
export type ListSpacesQuery = z.infer<typeof listSpacesQuerySchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type NowQuery = z.infer<typeof nowQuerySchema>;
export const reservationIdSchema = z.uuid();

export const createReservationSchema = z.strictObject({
  spaceId: z.uuid(),
  purpose: z.string().trim().min(2).max(250),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true })
}).refine(
  (data) => Date.parse(data.endsAt) > Date.parse(data.startsAt),
  {
    message: "El fin debe ser posterior al inicio",
    path: ["endsAt"]
  }
);

export type CreateReservationInput = z.infer<
  typeof createReservationSchema
>;

export const apiKeyPermissionSchema = z.enum([
  "read:spaces",
  "read:now"
]);

export const apiKeyIdSchema = z.uuid();

export const createApiKeySchema = z.strictObject({
  name: z.string().trim().min(2).max(100),

  permissions: z.array(apiKeyPermissionSchema)
    .min(1)
    .max(2),

  expiresAt: z.iso.datetime({ offset: true })
    .nullable()
    .optional()
}).refine(
  (data) =>
    data.expiresAt == null ||
    Date.parse(data.expiresAt) > Date.now(),
  {
    message: "La expiracion debe ser una fecha futura",
    path: ["expiresAt"]
  }
);

export type ApiKeyPermission = z.infer<
  typeof apiKeyPermissionSchema
>;

export type CreateApiKeyInput = z.infer<
  typeof createApiKeySchema
>;