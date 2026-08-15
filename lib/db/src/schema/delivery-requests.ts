import { pgTable, text, serial, timestamp, integer, pgEnum, doublePrecision } from "drizzle-orm/pg-core";
import { farmsTable } from "./farms";
import { eggBatchesTable } from "./batches";

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "PENDING",
  "CONFIRMED",
  "DISPATCHED",
  "DELIVERED",
  "CANCELLED",
]);

export const locationSourceEnum = pgEnum("location_source", [
  "gps",
  "map",
  "manual",
]);

export const deliveryRequestsTable = pgTable("delivery_requests", {
  id: serial("id").primaryKey(),
  batchCode: text("batch_code").notNull(),
  farmCode: text("farm_code").notNull(),
  farmId: integer("farm_id").notNull().references(() => farmsTable.id, { onDelete: "cascade" }),
  batchId: integer("batch_id").notNull().references(() => eggBatchesTable.id, { onDelete: "cascade" }),
  buyerName: text("buyer_name").notNull(),
  buyerPhone: text("buyer_phone").notNull(),
  /** Optional text fields — filled automatically from reverse geocode when GPS/map is used */
  state: text("state"),
  lga: text("lga"),
  town: text("town"),
  streetAddress: text("street_address"),
  marketArea: text("market_area"),
  village: text("village"),
  landmark: text("landmark"),
  /** Absolute pin — preferred for clustering trucks */
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  locationSource: locationSourceEnum("location_source").default("manual"),
  /** Human-readable label from reverse geocode, e.g. "Douglas Rd, Owerri, Imo" */
  locationLabel: text("location_label"),
  quantityCrates: integer("quantity_crates").notNull(),
  status: deliveryStatusEnum("status").notNull().default("PENDING"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DeliveryRequest = typeof deliveryRequestsTable.$inferSelect;
