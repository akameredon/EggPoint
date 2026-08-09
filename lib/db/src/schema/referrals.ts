import { pgTable, text, serial, timestamp, integer, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * Referral / affiliate codes for street activation + growth loop.
 * Every user can have a code; installs and first-buyer events are tracked.
 */
export const referralEventTypeEnum = pgEnum("referral_event_type", [
  "INSTALL",
  "SIGNUP",
  "FIRST_ORDER",
  "PAYOUT",
]);

export const referralCodesTable = pgTable("referral_codes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  code: text("code").notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const referralEventsTable = pgTable("referral_events", {
  id: serial("id").primaryKey(),
  codeId: integer("code_id")
    .notNull()
    .references(() => referralCodesTable.id),
  eventType: referralEventTypeEnum("event_type").notNull(),
  referredUserId: integer("referred_user_id").references(() => usersTable.id),
  meta: text("meta"), // optional JSON string for campaign team / location notes
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReferralCodeSchema = createInsertSchema(referralCodesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertReferralCode = z.infer<typeof insertReferralCodeSchema>;
export type ReferralCode = typeof referralCodesTable.$inferSelect;

export const insertReferralEventSchema = createInsertSchema(referralEventsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertReferralEvent = z.infer<typeof insertReferralEventSchema>;
export type ReferralEvent = typeof referralEventsTable.$inferSelect;
