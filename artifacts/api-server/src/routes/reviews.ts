import { Router, type IRouter } from "express";
import { db, farmsTable, reviewsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateReviewBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/farms/:farmCode/reviews", async (req, res): Promise<void> => {
  const farmCode = req.params.farmCode as string;

  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.farmCode, farmCode));
  if (!farm) {
    res.status(404).json({ error: "Farm not found" });
    return;
  }

  const reviews = await db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.farmId, farm.id))
    .orderBy(desc(reviewsTable.createdAt));

  res.json(reviews.map(r => ({
    id: r.id,
    farmId: r.farmId,
    buyerName: r.buyerName,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/farms/:farmCode/reviews", async (req, res): Promise<void> => {
  const farmCode = req.params.farmCode as string;

  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.farmCode, farmCode));
  if (!farm) {
    res.status(404).json({ error: "Farm not found" });
    return;
  }

  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [review] = await db
    .insert(reviewsTable)
    .values({
      farmId: farm.id,
      buyerName: parsed.data.buyerName,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    })
    .returning();

  res.status(201).json({
    id: review.id,
    farmId: review.farmId,
    buyerName: review.buyerName,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
  });
});

export default router;
