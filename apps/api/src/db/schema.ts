import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  time,
  timestamp,
  check,
  index
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", [
  "administrador",
  "docente",
  "estudiante"
]);

export const reservationStatus = pgEnum("reservation_status", [
  "confirmada",
  "cancelada"
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").default("estudiante").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
});

export const spaces = pgTable(
  "spaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    building: varchar("building", { length: 100 })
      .default("Sin asignar")
      .notNull(),
    location: varchar("location", { length: 150 }).notNull(),
    capacity: integer("capacity").notNull(),
    opensAt: time("opens_at").default("07:00:00").notNull(),
    closesAt: time("closes_at").default("22:00:00").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    check(
      "spaces_capacity_positive",
      sql`${table.capacity} > 0`
    ),
    check(
      "spaces_valid_schedule",
      sql`${table.closesAt} > ${table.opensAt}`
    )
  ]
);

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id),
    purpose: varchar("purpose", { length: 250 }).notNull(),
    startsAt: timestamp("starts_at", {
      withTimezone: true
    }).notNull(),
    endsAt: timestamp("ends_at", {
      withTimezone: true
    }).notNull(),
    status: reservationStatus("status")
      .default("confirmada")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    check(
      "reservations_valid_period",
      sql`${table.endsAt} > ${table.startsAt}`
    ),
    index("reservations_space_period_idx").on(
      table.spaceId,
      table.startsAt,
      table.endsAt
    ),
    index("reservations_user_idx").on(table.userId)
  ]
);

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", {
    withTimezone: true
  }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull()
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 100 }).notNull(),

  prefix: varchar("prefix", { length: 32 })
    .default("rl_live_")
    .notNull(),

  keyHash: text("key_hash").notNull().unique(),

  permissions: text("permissions")
    .array()
    .default(sql`ARRAY[]::text[]`)
    .notNull(),

  lastUsedAt: timestamp("last_used_at", {
    withTimezone: true
  }),

  expiresAt: timestamp("expires_at", {
    withTimezone: true
  }),

  revokedAt: timestamp("revoked_at", {
    withTimezone: true
  }),

  createdAt: timestamp("created_at", {
    withTimezone: true
  })
    .defaultNow()
    .notNull()
});