import { Router, type IRouter } from "express";
import { db, farmsTable, eggBatchesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateBatchBody, UpdateBatchBody, ListBatchesQueryParams, GetBatchParams, UpdateBatchParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { generateBatchCode, daysOld } from "../lib/codegen";

const router: IRouter = Router();

async function enrichBatch(batch: typeof eggBatchesTable.$inferSelect) {
  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, batch.farmId));
  return {
    id: batch.id,
    batchCode: batch.batchCode,
    farmId: batch.farmId,
    farmCode: farm?.farmCode ?? "",
    farmName: farm?.farmName ?? "",
    farmState: farm?.state ?? "",
    quantityCrates: batch.quantityCrates,
    eggSize: batch.eggSize,
    pricePerCrate: Number(batch.pricePerCrate),
    collectionDate: batch.collectionDate,
    daysOld: daysOld(batch.collectionDate),
    status: batch.status,
    createdAt: batch.createdAt.toISOString(),
  };
}

router.get("/batches", async (req, res): Promise<void> => {
  const params = ListBatchesQueryParams.safeParse(req.query);
  const farmCodeFilter = params.success ? params.data.farmCode : undefined;
  const eggSizeFilter = params.success ? params.data.eggSize : undefined;
  const stateFilter = params.success ? params.data.state : undefined;

  const conditions: ReturnType<typeof eq>[] = [eq(eggBatchesTable.status, "ACTIVE")];

  if (eggSizeFilter) {
    conditions.push(eq(eggBatchesTable.eggSize, eggSizeFilter as "SMALL" | "MEDIUM" | "LARGE" | "JUMBO"));
  }

  let batches = await db.select().from(eggBatchesTable).where(
    conditions.length > 1 ? and(...conditions) : conditions[0]
  );

  if (farmCodeFilter) {
    const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.farmCode, farmCodeFilter));
    if (farm) {
      batches = batches.filter(b => b.farmId === farm.id);
    } else {
      batches = [];
    }
  }

  let enriched = await Promise.all(batches.map(enrichBatch));

  if (stateFilter) {
    enriched = enriched.filter(b => b.farmState === stateFilter);
  }

  res.json(enriched);
});

router.post("/batches", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateBatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { farmCode, quantityCrates, eggSize, pricePerCrate, collectionDate } = parsed.data;

  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.farmCode, farmCode));
  if (!farm) {
    res.status(400).json({ error: "Farm not found" });
    return;
  }

  if (farm.ownerId !== req.session.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const batchCode = generateBatchCode(collectionDate);

  const [batch] = await db
    .insert(eggBatchesTable)
    .values({
      batchCode,
      farmId: farm.id,
      quantityCrates,
      eggSize: eggSize as "SMALL" | "MEDIUM" | "LARGE" | "JUMBO",
      pricePerCrate: String(pricePerCrate),
      collectionDate,
      status: "ACTIVE",
    })
    .returning();

  const enriched = await enrichBatch(batch);
  res.status(201).json(enriched);
});

router.get("/batches/:batchCode", async (req, res): Promise<void> => {
  const batchCode = Array.isArray(req.params.batchCode) ? req.params.batchCode[0] : req.params.batchCode;

  const [batch] = await db.select().from(eggBatchesTable).where(eq(eggBatchesTable.batchCode, batchCode));
  if (!batch) {
    res.status(404).json({ error: "Batch not found" });
    return;
  }

  const enriched = await enrichBatch(batch);
  res.json(enriched);
});

router.patch("/batches/:batchCode", requireAuth, async (req, res): Promise<void> => {
  const batchCode = Array.isArray(req.params.batchCode) ? req.params.batchCode[0] : req.params.batchCode;

  const [batch] = await db.select().from(eggBatchesTable).where(eq(eggBatchesTable.batchCode, batchCode));
  if (!batch) {
    res.status(404).json({ error: "Batch not found" });
    return;
  }

  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, batch.farmId));
  if (!farm || farm.ownerId !== req.session.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = UpdateBatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.quantityCrates != null) updates.quantityCrates = parsed.data.quantityCrates;
  if (parsed.data.pricePerCrate != null) updates.pricePerCrate = String(parsed.data.pricePerCrate);
  if (parsed.data.status != null) updates.status = parsed.data.status;

  const [updated] = await db.update(eggBatchesTable).set(updates).where(eq(eggBatchesTable.batchCode, batchCode)).returning();
  const enriched = await enrichBatch(updated);
  res.json(enriched);
});

export { enrichBatch };
export default router;
