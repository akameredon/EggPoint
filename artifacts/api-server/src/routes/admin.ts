import { Router, type IRouter } from "express";
import { db, farmsTable, eggBatchesTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { VerifyFarmBody } from "@workspace/api-zod";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

async function enrichFarm(farm: typeof farmsTable.$inferSelect) {
  const [owner] = await db.select({ fullName: usersTable.fullName, phone: usersTable.phone })
    .from(usersTable).where(eq(usersTable.id, farm.ownerId));

  const [batchStats] = await db
    .select({
      activeBatchCount: sql<number>`count(*) filter (where ${eggBatchesTable.status} = 'ACTIVE')`,
      totalCratesAvailable: sql<number>`coalesce(sum(${eggBatchesTable.quantityCrates}) filter (where ${eggBatchesTable.status} = 'ACTIVE'), 0)`,
    })
    .from(eggBatchesTable)
    .where(eq(eggBatchesTable.farmId, farm.id));

  return {
    id: farm.id,
    farmCode: farm.farmCode,
    ownerId: farm.ownerId,
    ownerName: owner?.fullName ?? null,
    ownerPhone: owner?.phone ?? null,
    farmName: farm.farmName,
    state: farm.state,
    lga: farm.lga,
    description: farm.description,
    verified: farm.verified,
    subscriptionTier: farm.subscriptionTier,
    activeBatchCount: Number(batchStats?.activeBatchCount ?? 0),
    totalCratesAvailable: Number(batchStats?.totalCratesAvailable ?? 0),
    createdAt: farm.createdAt.toISOString(),
  };
}

router.get("/admin/farms", requireAdmin, async (req, res): Promise<void> => {
  const farms = await db.select().from(farmsTable).where(eq(farmsTable.verified, false));
  const enriched = await Promise.all(farms.map(enrichFarm));
  res.json(enriched);
});

router.patch("/admin/farms/:farmCode/verify", requireAdmin, async (req, res): Promise<void> => {
  const farmCode = Array.isArray(req.params.farmCode) ? req.params.farmCode[0] : req.params.farmCode;

  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.farmCode, farmCode));
  if (!farm) {
    res.status(404).json({ error: "Farm not found" });
    return;
  }

  const parsed = VerifyFarmBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(farmsTable)
    .set({ verified: parsed.data.verified })
    .where(eq(farmsTable.farmCode, farmCode))
    .returning();

  const enriched = await enrichFarm(updated);
  res.json(enriched);
});

export default router;
