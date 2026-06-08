import { Router, type IRouter } from "express";
import { db, farmsTable, eggBatchesTable, inquiriesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const [farmStats] = await db
    .select({
      totalFarms: sql<number>`count(*)`,
      verifiedFarms: sql<number>`count(*) filter (where ${farmsTable.verified} = true)`,
      statesCovered: sql<number>`count(distinct ${farmsTable.state})`,
    })
    .from(farmsTable);

  const [batchStats] = await db
    .select({
      totalBatches: sql<number>`count(*)`,
      totalCratesAvailable: sql<number>`coalesce(sum(${eggBatchesTable.quantityCrates}) filter (where ${eggBatchesTable.status} = 'ACTIVE'), 0)`,
    })
    .from(eggBatchesTable);

  const [inquiryStats] = await db
    .select({
      totalInquiries: sql<number>`count(*)`,
    })
    .from(inquiriesTable);

  res.json({
    totalFarms: Number(farmStats?.totalFarms ?? 0),
    verifiedFarms: Number(farmStats?.verifiedFarms ?? 0),
    statesCovered: Number(farmStats?.statesCovered ?? 0),
    totalBatches: Number(batchStats?.totalBatches ?? 0),
    totalCratesAvailable: Number(batchStats?.totalCratesAvailable ?? 0),
    totalInquiries: Number(inquiryStats?.totalInquiries ?? 0),
  });
});

export default router;
