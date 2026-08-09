import { pgTable, text, serial, timestamp, integer, numeric, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Small-pledge capital tracker.
 * Friends commit ~10% of projected 20-year net worth, paid in tranches over 12–24 months.
 * Ownership / earnings calculated against full pledged amount while tranches are still outstanding.
 */
export const pledgeStatusEnum = pgEnum("pledge_status", [
  "PLEDGED",
  "ACTIVE",
  "COMPLETED",
  "DEFAULTED",
  "CANCELLED",
]);

export const pledgesTable = pgTable("pledges", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  /** Full amount committed (e.g. 2_000_000 for ₦2m) in kobo or naira — store as naira whole numbers */
  pledgedAmountNaira: integer("pledged_amount_naira").notNull(),
  /** Amount paid in so far */
  paidAmountNaira: integer("paid_amount_naira").notNull().default(0),
  /** Months over which the pledge is expected to complete */
  trancheMonths: integer("tranche_months").notNull().default(12),
  projectedNetWorth20y: integer("projected_net_worth_20y"),
  status: pledgeStatusEnum("status").notNull().default("PLEDGED"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pledgePaymentsTable = pgTable("pledge_payments", {
  id: serial("id").primaryKey(),
  pledgeId: integer("pledge_id")
    .notNull()
    .references(() => pledgesTable.id),
  amountNaira: integer("amount_naira").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  reference: text("reference"),
  notes: text("notes"),
});

export const insertPledgeSchema = createInsertSchema(pledgesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  paidAmountNaira: true,
});
export type InsertPledge = z.infer<typeof insertPledgeSchema>;
export type Pledge = typeof pledgesTable.$inferSelect;
