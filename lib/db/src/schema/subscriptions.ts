import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { farmsTable } from "./farms";

export const paymentStatusEnum = pgEnum("payment_status", ["PENDING", "COMPLETED", "FAILED"]);

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  farmId: integer("farm_id").notNull().references(() => farmsTable.id, { onDelete: "cascade" }),
  flwTxRef: text("flw_tx_ref").notNull().unique(),
  flwTxId: text("flw_tx_id"),
  amountNgn: integer("amount_ngn").notNull(),
  status: paymentStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type Subscription = typeof subscriptionsTable.$inferSelect;
