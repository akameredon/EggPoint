import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const inquiryStatusEnum = pgEnum("inquiry_status", ["PENDING", "RESPONDED", "CLOSED"]);

export const inquiriesTable = pgTable("inquiries", {
  id: serial("id").primaryKey(),
  buyerName: text("buyer_name").notNull(),
  buyerPhone: text("buyer_phone").notNull(),
  farmId: integer("farm_id").notNull(),
  batchId: integer("batch_id").notNull(),
  quantityCrates: integer("quantity_crates").notNull(),
  message: text("message").notNull(),
  status: inquiryStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInquirySchema = createInsertSchema(inquiriesTable).omit({ id: true, createdAt: true, status: true });
export type InsertInquiry = z.infer<typeof insertInquirySchema>;
export type Inquiry = typeof inquiriesTable.$inferSelect;
