import { Router, type IRouter } from "express";
import { db, farmsTable, eggBatchesTable, inquiriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateInquiryBody, UpdateInquiryBody, UpdateInquiryParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

async function enrichInquiry(inquiry: typeof inquiriesTable.$inferSelect) {
  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, inquiry.farmId));
  const [batch] = await db.select().from(eggBatchesTable).where(eq(eggBatchesTable.id, inquiry.batchId));

  return {
    id: inquiry.id,
    buyerName: inquiry.buyerName,
    buyerPhone: inquiry.buyerPhone,
    farmCode: farm?.farmCode ?? "",
    batchCode: batch?.batchCode ?? "",
    quantityCrates: inquiry.quantityCrates,
    message: inquiry.message,
    status: inquiry.status,
    createdAt: inquiry.createdAt.toISOString(),
  };
}

router.get("/inquiries", requireAuth, async (req, res): Promise<void> => {
  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.ownerId, req.session.userId!));
  if (!farm) {
    res.json([]);
    return;
  }

  const list = await db.select().from(inquiriesTable).where(eq(inquiriesTable.farmId, farm.id));
  const enriched = await Promise.all(list.map(enrichInquiry));
  res.json(enriched);
});

router.post("/inquiries", async (req, res): Promise<void> => {
  const parsed = CreateInquiryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { buyerName, buyerPhone, farmCode, batchCode, quantityCrates, message } = parsed.data;

  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.farmCode, farmCode));
  if (!farm) {
    res.status(400).json({ error: "Farm not found" });
    return;
  }

  const [batch] = await db.select().from(eggBatchesTable).where(eq(eggBatchesTable.batchCode, batchCode));
  if (!batch) {
    res.status(400).json({ error: "Batch not found" });
    return;
  }

  const [inquiry] = await db
    .insert(inquiriesTable)
    .values({
      buyerName,
      buyerPhone,
      farmId: farm.id,
      batchId: batch.id,
      quantityCrates,
      message,
    })
    .returning();

  const enriched = await enrichInquiry(inquiry);
  res.status(201).json(enriched);
});

router.patch("/inquiries/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [inquiry] = await db.select().from(inquiriesTable).where(eq(inquiriesTable.id, id));
  if (!inquiry) {
    res.status(404).json({ error: "Inquiry not found" });
    return;
  }

  const parsed = UpdateInquiryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof inquiry> = {};
  if (parsed.data.status != null) updates.status = parsed.data.status;

  const [updated] = await db.update(inquiriesTable).set(updates).where(eq(inquiriesTable.id, id)).returning();
  const enriched = await enrichInquiry(updated);
  res.json(enriched);
});

export default router;
