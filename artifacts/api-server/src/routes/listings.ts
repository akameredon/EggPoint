import { Router, type IRouter } from "express";
import { db, farmsTable, eggBatchesTable, usersTable } from "@workspace/db";
import { eq, and, ilike, or, gte } from "drizzle-orm";
import { ListListingsQueryParams } from "@workspace/api-zod";
import { daysOld } from "../lib/codegen";

const router: IRouter = Router();

router.get("/listings", async (req, res): Promise<void> => {
  const params = ListListingsQueryParams.safeParse(req.query);
  const stateFilter = params.success ? params.data.state : undefined;
  const eggSizeFilter = params.success ? params.data.eggSize : undefined;
  const searchFilter = params.success ? params.data.search : undefined;
  const minCratesFilter = params.success ? params.data.minCrates : undefined;

  const farmConditions = [eq(farmsTable.verified, true)];
  if (stateFilter) farmConditions.push(eq(farmsTable.state, stateFilter));
  if (searchFilter) {
    farmConditions.push(
      or(
        ilike(farmsTable.farmName, `%${searchFilter}%`),
        ilike(farmsTable.state, `%${searchFilter}%`),
        ilike(farmsTable.lga, `%${searchFilter}%`),
      )!
    );
  }

  const farms = await db.select().from(farmsTable).where(
    farmConditions.length > 1 ? and(...farmConditions) : farmConditions[0]
  );

  if (farms.length === 0) {
    res.json([]);
    return;
  }

  const farmIds = farms.map(f => f.id);

  const batchConditions: ReturnType<typeof eq>[] = [eq(eggBatchesTable.status, "ACTIVE")];
  if (eggSizeFilter) {
    batchConditions.push(eq(eggBatchesTable.eggSize, eggSizeFilter as "SMALL" | "MEDIUM" | "LARGE" | "JUMBO"));
  }
  if (minCratesFilter) {
    batchConditions.push(gte(eggBatchesTable.quantityCrates, minCratesFilter) as ReturnType<typeof eq>);
  }

  const allBatches = await db.select().from(eggBatchesTable).where(
    batchConditions.length > 1 ? and(...batchConditions) : batchConditions[0]
  );

  const filteredBatches = allBatches.filter(b => farmIds.includes(b.farmId));

  const farmMap = new Map(farms.map(f => [f.id, f]));

  const ownerIds = [...new Set(farms.map(f => f.ownerId))];
  const owners = await db.select().from(usersTable);
  const ownerMap = new Map(owners.map(u => [u.id, u]));

  const listings = filteredBatches.map(batch => {
    const farm = farmMap.get(batch.farmId)!;
    const owner = ownerMap.get(farm.ownerId);

    return {
      batchCode: batch.batchCode,
      farmCode: farm.farmCode,
      farmName: farm.farmName,
      state: farm.state,
      lga: farm.lga,
      description: farm.description,
      eggSize: batch.eggSize,
      quantityCrates: batch.quantityCrates,
      pricePerCrate: Number(batch.pricePerCrate),
      collectionDate: batch.collectionDate,
      daysOld: daysOld(batch.collectionDate),
      verified: farm.verified,
      ownerPhone: owner?.phone ?? null,
      ownerName: owner?.fullName ?? null,
      subscriptionTier: farm.subscriptionTier,
    };
  });

  listings.sort((a, b) => {
    if (a.subscriptionTier === "FEATURED" && b.subscriptionTier !== "FEATURED") return -1;
    if (b.subscriptionTier === "FEATURED" && a.subscriptionTier !== "FEATURED") return 1;
    return a.daysOld - b.daysOld;
  });

  res.json(listings);
});

export default router;
