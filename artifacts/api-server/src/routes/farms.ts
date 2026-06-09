import { Router, type IRouter } from "express";
import { db, usersTable, farmsTable, eggBatchesTable } from "@workspace/db";
import { eq, and, ilike, or, sql } from "drizzle-orm";
import { CreateFarmBody, UpdateFarmBody, ListFarmsQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { generateFarmCode } from "../lib/codegen";

const router: IRouter = Router();

async function enrichFarm(farm: typeof farmsTable.$inferSelect) {
  const owner = await db.select({ fullName: usersTable.fullName, phone: usersTable.phone })
    .from(usersTable).where(eq(usersTable.id, farm.ownerId));

  const batchStats = await db
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
    ownerName: owner[0]?.fullName ?? null,
    ownerPhone: owner[0]?.phone ?? null,
    farmName: farm.farmName,
    state: farm.state,
    lga: farm.lga,
    description: farm.description,
    verified: farm.verified,
    subscriptionTier: farm.subscriptionTier,
    featuredUntil: farm.featuredUntil ? farm.featuredUntil.toISOString() : null,
    activeBatchCount: Number(batchStats[0]?.activeBatchCount ?? 0),
    totalCratesAvailable: Number(batchStats[0]?.totalCratesAvailable ?? 0),
    createdAt: farm.createdAt.toISOString(),
  };
}

router.get("/farms", async (req, res): Promise<void> => {
  const params = ListFarmsQueryParams.safeParse(req.query);
  const stateFilter = params.success ? params.data.state : undefined;
  const searchFilter = params.success ? params.data.search : undefined;

  let query = db.select().from(farmsTable).where(eq(farmsTable.verified, true));

  const conditions = [eq(farmsTable.verified, true)];
  if (stateFilter) {
    conditions.push(eq(farmsTable.state, stateFilter));
  }
  if (searchFilter) {
    conditions.push(
      or(
        ilike(farmsTable.farmName, `%${searchFilter}%`),
        ilike(farmsTable.lga, `%${searchFilter}%`),
      )!
    );
  }

  const farms = await db.select().from(farmsTable)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0]);

  const enriched = await Promise.all(farms.map(enrichFarm));

  enriched.sort((a, b) => {
    if (a.subscriptionTier === "FEATURED" && b.subscriptionTier !== "FEATURED") return -1;
    if (b.subscriptionTier === "FEATURED" && a.subscriptionTier !== "FEATURED") return 1;
    return 0;
  });

  res.json(enriched);
});

router.post("/farms", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateFarmBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { farmName, state, lga, description } = parsed.data;
  const farmCode = await generateFarmCode(state, lga);

  const [farm] = await db
    .insert(farmsTable)
    .values({
      farmCode,
      ownerId: req.session.userId!,
      farmName,
      state,
      lga,
      description: description ?? null,
      verified: false,
      subscriptionTier: "FREE",
    })
    .returning();

  const enriched = await enrichFarm(farm);
  res.status(201).json(enriched);
});

router.get("/farms/:farmCode", async (req, res): Promise<void> => {
  const farmCode = Array.isArray(req.params.farmCode) ? req.params.farmCode[0] : req.params.farmCode;

  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.farmCode, farmCode));
  if (!farm) {
    res.status(404).json({ error: "Farm not found" });
    return;
  }

  const enriched = await enrichFarm(farm);
  res.json(enriched);
});

router.patch("/farms/:farmCode", requireAuth, async (req, res): Promise<void> => {
  const farmCode = Array.isArray(req.params.farmCode) ? req.params.farmCode[0] : req.params.farmCode;

  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.farmCode, farmCode));
  if (!farm) {
    res.status(404).json({ error: "Farm not found" });
    return;
  }

  if (farm.ownerId !== req.session.userId && req.session.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = UpdateFarmBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof farm> = {};
  if (parsed.data.farmName != null) updates.farmName = parsed.data.farmName;
  if (parsed.data.lga != null) updates.lga = parsed.data.lga;
  if (parsed.data.description != null) updates.description = parsed.data.description;

  const [updated] = await db.update(farmsTable).set(updates).where(eq(farmsTable.farmCode, farmCode)).returning();
  const enriched = await enrichFarm(updated);
  res.json(enriched);
});

export { enrichFarm };
export default router;
