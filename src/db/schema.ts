import { relations } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Core registry tables for society / building / flat hierarchy
 * and resident registration (including ownership-transfer claims).
 */
export const societies = pgTable("societies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  code: varchar("code", { length: 64 }),
  /** Used by GET /api/societies to return only active societies. */
  isActive: boolean("is_active").notNull().default(true),
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

export const registrationRequests = pgTable("registration_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  societyId: uuid("society_id")
    .notNull()
    .references(() => societies.id, { onDelete: "cascade" }),
  buildingId: uuid("building_id")
    .notNull()
    .references(() => buildings.id, { onDelete: "cascade" }),
  flatId: uuid("flat_id")
    .notNull()
    .references(() => flats.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  isOwnershipTransfer: boolean("is_ownership_transfer").notNull().default(false),
  supportingDocumentUrl: text("supporting_document_url"),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const societiesRelations = relations(societies, ({ many }) => ({
  buildings: many(buildings),
  registrationRequests: many(registrationRequests),
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
}));

export type Society = typeof societies.$inferSelect;
export type Building = typeof buildings.$inferSelect;
export type Flat = typeof flats.$inferSelect;
export type RegistrationRequest = typeof registrationRequests.$inferSelect;
