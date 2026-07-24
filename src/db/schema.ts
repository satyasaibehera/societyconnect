import { relations } from "drizzle-orm";
import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Core registry + dependent registration state machine.
 *
 * FlatRequest  → addition_requests (PENDING until Society Admin approves)
 * UserRegistration → registration_requests
 *   WAITING_FOR_FLAT while linked FlatRequest is unapproved
 *   READY_FOR_REVIEW once flat exists in master flats table
 */

export const additionRequestedTypeEnum = pgEnum("addition_requested_type", [
  "building",
  "flat",
]);

export const societies = pgTable("societies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  code: varchar("code", { length: 64 }),
  city: text("city"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const buildings = pgTable("buildings", {
  id: uuid("id").defaultRandom().primaryKey(),
  societyId: uuid("society_id")
    .notNull()
    .references(() => societies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const flats = pgTable("flats", {
  id: uuid("id").defaultRandom().primaryKey(),
  buildingId: uuid("building_id")
    .notNull()
    .references(() => buildings.id, { onDelete: "cascade" }),
  flatNumber: text("flat_number").notNull(),
  isOccupied: boolean("is_occupied").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** FlatRequest — proposed building/flat pending Society Admin approval. */
export const additionRequests = pgTable("addition_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  societyId: uuid("society_id")
    .notNull()
    .references(() => societies.id, { onDelete: "cascade" }),
  requestedType: additionRequestedTypeEnum("requested_type").notNull(),
  /** Display / legacy single-name field */
  requestedName: text("requested_name").notNull(),
  buildingName: text("building_name"),
  flatNumber: text("flat_number"),
  notes: text("notes"),
  status: varchar("status", { length: 32 }).notNull().default("PENDING"),
  resolvedBuildingId: uuid("resolved_building_id").references(() => buildings.id, {
    onDelete: "set null",
  }),
  resolvedFlatId: uuid("resolved_flat_id").references(() => flats.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * UserRegistration — may link to a FlatRequest while waiting for flat creation.
 * building_id / flat_id are null until the FlatRequest is approved.
 */
export const registrationRequests = pgTable("registration_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  societyId: uuid("society_id")
    .notNull()
    .references(() => societies.id, { onDelete: "cascade" }),
  buildingId: uuid("building_id").references(() => buildings.id, { onDelete: "cascade" }),
  flatId: uuid("flat_id").references(() => flats.id, { onDelete: "cascade" }),
  flatRequestId: uuid("flat_request_id").references(() => additionRequests.id, {
    onDelete: "set null",
  }),
  fullName: text("full_name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  email: text("email"),
  residentType: varchar("resident_type", { length: 32 }),
  isOwnershipTransfer: boolean("is_ownership_transfer").notNull().default(false),
  supportingDocumentUrl: text("supporting_document_url"),
  /** WAITING_FOR_FLAT | READY_FOR_REVIEW | approved | rejected */
  status: varchar("status", { length: 32 }).notNull().default("READY_FOR_REVIEW"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const societiesRelations = relations(societies, ({ many }) => ({
  buildings: many(buildings),
  registrationRequests: many(registrationRequests),
  additionRequests: many(additionRequests),
}));

export const buildingsRelations = relations(buildings, ({ one, many }) => ({
  society: one(societies, {
    fields: [buildings.societyId],
    references: [societies.id],
  }),
  flats: many(flats),
  registrationRequests: many(registrationRequests),
}));

export const flatsRelations = relations(flats, ({ one, many }) => ({
  building: one(buildings, {
    fields: [flats.buildingId],
    references: [buildings.id],
  }),
  registrationRequests: many(registrationRequests),
}));

export const additionRequestsRelations = relations(additionRequests, ({ one, many }) => ({
  society: one(societies, {
    fields: [additionRequests.societyId],
    references: [societies.id],
  }),
  registrationRequests: many(registrationRequests),
}));

export const registrationRequestsRelations = relations(registrationRequests, ({ one }) => ({
  society: one(societies, {
    fields: [registrationRequests.societyId],
    references: [societies.id],
  }),
  building: one(buildings, {
    fields: [registrationRequests.buildingId],
    references: [buildings.id],
  }),
  flat: one(flats, {
    fields: [registrationRequests.flatId],
    references: [flats.id],
  }),
  flatRequest: one(additionRequests, {
    fields: [registrationRequests.flatRequestId],
    references: [additionRequests.id],
  }),
}));

export type Society = typeof societies.$inferSelect;
export type Building = typeof buildings.$inferSelect;
export type Flat = typeof flats.$inferSelect;
export type RegistrationRequest = typeof registrationRequests.$inferSelect;
export type AdditionRequest = typeof additionRequests.$inferSelect;
