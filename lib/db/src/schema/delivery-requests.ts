import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { farmsTable } from "./farms";
import { eggBatchesTable } from "./batches";

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "PENDING",
  "CONFIRMED",
  "DISPATCHED",
  "DELIVERED",
  "CANCELLED",
]);

export const deliveryRequestsTable = pgTable("delivery_requests", {
  id: serial("id").primaryKey(),
  batchCode: text("batch_code").notNull(),
  farmCode: text("farm_code").notNull(),
  farmId: integer("farm_id").notNull().references(() => farmsTable.id, { onDelete: "cascade" }),
  batchId: integer("batch_id").notNull().references(() => eggBatchesTable.id, { onDelete: "cascade" }),
  buyerName: text("buyer_name").notNull(),
  buyerPhone: text("buyer_phone").notNull(),
  state: text("state").notNull(),
  lga: text("lga").notNull(),
  town: text("town").notNull(),
  streetAddress: text("street_address").notNull(),
  marketArea: text("market_area"),
  village: text("village"),
  landmark: text("landmark"),
  quantityCrates: integer("quantity_crates").notNull(),
  status: deliveryStatusEnum("status").notNull().default("PENDING"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DeliveryRequest = typeof deliveryRequestsTable.$inferSelect;
