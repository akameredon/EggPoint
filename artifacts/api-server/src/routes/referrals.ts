import { Router, type IRouter } from "express";
import { db, referralCodesTable, referralEventsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

function makeCode(userId: number): string {
  // Short, street-friendly code: EP + base36 user id + random
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `EP${userId.toString(36).toUpperCase()}${rand}`;
}

/** Get or create referral code for the logged-in user */
router.get("/referrals/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  let [codeRow] = await db
    .select()
    .from(referralCodesTable)
    .where(and(eq(referralCodesTable.userId, userId), eq(referralCodesTable.active, true)));

  if (!codeRow) {
    const code = makeCode(userId);
    [codeRow] = await db
      .insert(referralCodesTable)
      .values({ userId, code })
      .returning();
  }

  const events = await db
    .select()
    .from(referralEventsTable)
    .where(eq(referralEventsTable.codeId, codeRow.id));

  const counts = {
    installs: events.filter((e) => e.eventType === "INSTALL").length,
    signups: events.filter((e) => e.eventType === "SIGNUP").length,
    firstOrders: events.filter((e) => e.eventType === "FIRST_ORDER").length,
  };

  res.json({
    code: codeRow.code,
    active: codeRow.active,
    joinPath: `/join?ref=${codeRow.code}`,
    counts,
  });
});

/** Public: record a referral event (install/signup) from QR landing */
router.post("/referrals/track", async (req, res): Promise<void> => {
  const { code, eventType, meta } = req.body as {
    code?: string;
    eventType?: string;
    meta?: string;
  };

  if (!code || !eventType) {
    res.status(400).json({ error: "code and eventType required" });
    return;
  }

  const allowed = ["INSTALL", "SIGNUP", "FIRST_ORDER"];
  if (!allowed.includes(eventType)) {
    res.status(400).json({ error: "Invalid eventType" });
    return;
  }

  const [codeRow] = await db
    .select()
    .from(referralCodesTable)
    .where(and(eq(referralCodesTable.code, code.toUpperCase()), eq(referralCodesTable.active, true)));

  if (!codeRow) {
    res.status(404).json({ error: "Unknown or inactive referral code" });
    return;
  }

  const [event] = await db
    .insert(referralEventsTable)
    .values({
      codeId: codeRow.id,
      eventType: eventType as "INSTALL" | "SIGNUP" | "FIRST_ORDER",
      referredUserId: req.session?.userId ?? null,
      meta: meta ?? null,
    })
    .returning();

  res.status(201).json({ success: true, eventId: event.id });
});

/** Resolve a code (public, for join page display) */
router.get("/referrals/resolve/:code", async (req, res): Promise<void> => {
  const code = req.params.code.toUpperCase();
  const [codeRow] = await db
    .select({
      code: referralCodesTable.code,
      active: referralCodesTable.active,
      fullName: usersTable.fullName,
    })
    .from(referralCodesTable)
    .leftJoin(usersTable, eq(referralCodesTable.userId, usersTable.id))
    .where(eq(referralCodesTable.code, code));

  if (!codeRow || !codeRow.active) {
    res.status(404).json({ error: "Code not found" });
    return;
  }

  res.json({
    code: codeRow.code,
    referrerName: codeRow.fullName,
  });
});

export default router;
