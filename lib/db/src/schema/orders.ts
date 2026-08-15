import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  numeric,
  doublePrecision,
  pgEnum,
  boolean,
} from "drizzle-orm/pg-core";
import { farmsTable } from "./farms";
import { eggBatchesTable } from "./batches";

export const orderStatusEnum = pgEnum("order_status", [
  "PENDING_PAYMENT",
  "PAID",
  "COD",
  "GROUPED",
  "DISPATCHED",
  "AWAITING_PICKUP",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
]);

export const orderPayMethodEnum = pgEnum("order_pay_method", [
  "ONLINE",
  "COD",
]);

export const orderLocationSourceEnum = pgEnum("order_location_source", [
  "gps",
  "map",
  "manual",
]);

/**
 * Paid (or COD) egg orders. Powers launch: pay → geo-cluster → truck → dual confirm.
 */
export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderCode: text("order_code").notNull().unique(),
  batchId: integer("batch_id").notNull().references(() => eggBatchesTable.id),
  farmId: integer("farm_id").notNull().references(() => farmsTable.id),
  batchCode: text("batch_code").notNull(),
  farmCode: text("farm_code").notNull(),

  buyerName: text("buyer_name").notNull(),
  buyerPhone: text("buyer_phone").notNull(),
  buyerEmail: text("buyer_email"),

  quantityCrates: integer("quantity_crates").notNull(),
  unitPriceNgn: numeric("unit_price_ngn", { precision: 12, scale: 2 }).notNull(),
  totalNgn: numeric("total_ngn", { precision: 12, scale: 2 }).notNull(),

  payMethod: orderPayMethodEnum("pay_method").notNull().default("ONLINE"),
  status: orderStatusEnum("status").notNull().default("PENDING_PAYMENT"),

  flwTxRef: text("flw_tx_ref").unique(),
  flwTxId: text("flw_tx_id"),
  paidAt: timestamp("paid_at", { withTimezone: true }),

  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  locationSource: orderLocationSourceEnum("location_source"),
  locationLabel: text("location_label"),
  state: text("state"),
  lga: text("lga"),
  town: text("town"),
  streetAddress: text("street_address"),

  /** Shared truck stop for the geo cluster */
  pickupPointLabel: text("pickup_point_label"),
  pickupWindow: text("pickup_window"),
  dispatchGroupKey: text("dispatch_group_key"),

  /** Magic links — no app install for driver/buyer confirm */
  driverToken: text("driver_token").unique(),
  buyerToken: text("buyer_token").notNull().unique(),

  driverConfirmedAt: timestamp("driver_confirmed_at", { withTimezone: true }),
  buyerConfirmedAt: timestamp("buyer_confirmed_at", { withTimezone: true }),
  driverNote: text("driver_note"),
  buyerNote: text("buyer_note"),

  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Order = typeof ordersTable.$inferSelect;
