import { pgTable, text, serial, timestamp, boolean, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const subscriptionTierEnum = pgEnum("subscription_tier", ["FREE", "FEATURED"]);

export const farmsTable = pgTable("farms", {
  id: serial("id").primaryKey(),
  farmCode: text("farm_code").notNull().unique(),
  ownerId: integer("owner_id").notNull(),
  farmName: text("farm_name").notNull(),
  state: text("state").notNull(),
  lga: text("lga").notNull(),
  description: text("description"),
  verified: boolean("verified").notNull().default(false),
  subscriptionTier: subscriptionTierEnum("subscription_tier").notNull().default("FREE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFarmSchema = createInsertSchema(farmsTable).omit({ id: true, createdAt: true, farmCode: true, verified: true });
export type InsertFarm = z.infer<typeof insertFarmSchema>;
export type Farm = typeof farmsTable.$inferSelect;
