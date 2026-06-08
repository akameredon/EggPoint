import { pgTable, text, serial, timestamp, integer, numeric, date, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eggSizeEnum = pgEnum("egg_size", ["SMALL", "MEDIUM", "LARGE", "JUMBO"]);
export const batchStatusEnum = pgEnum("batch_status", ["ACTIVE", "RESERVED", "SOLD_OUT", "ARCHIVED"]);

export const eggBatchesTable = pgTable("egg_batches", {
  id: serial("id").primaryKey(),
  batchCode: text("batch_code").notNull().unique(),
  farmId: integer("farm_id").notNull(),
  quantityCrates: integer("quantity_crates").notNull(),
  eggSize: eggSizeEnum("egg_size").notNull(),
  pricePerCrate: numeric("price_per_crate", { precision: 12, scale: 2 }).notNull(),
  collectionDate: date("collection_date", { mode: "string" }).notNull(),
  status: batchStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBatchSchema = createInsertSchema(eggBatchesTable).omit({ id: true, createdAt: true, batchCode: true });
export type InsertBatch = z.infer<typeof insertBatchSchema>;
export type EggBatch = typeof eggBatchesTable.$inferSelect;
