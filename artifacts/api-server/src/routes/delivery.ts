import { Router, type IRouter } from "express";
import { db, farmsTable, eggBatchesTable, deliveryRequestsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

router.post("/delivery-requests", async (req, res): Promise<void> => {
  const {
    batchCode,
    buyerName,
    buyerPhone,
    state,
    lga,
    town,
    streetAddress,
    marketArea,
    village,
    landmark,
    quantityCrates,
    notes,
  } = req.body as Record<string, string | number>;

  if (!batchCode || !buyerName || !buyerPhone || !state || !lga || !town || !streetAddress || !quantityCrates) {
    res.status(400).json({ error: "Missing required fields: batchCode, buyerName, buyerPhone, state, lga, town, streetAddress, quantityCrates" });
    return;
  }

  const [batch] = await db
    .select()
    .from(eggBatchesTable)
    .where(eq(eggBatchesTable.batchCode, String(batchCode)));

  if (!batch) {
    res.status(404).json({ error: "Batch not found" });
    return;
  }

  if (batch.status !== "ACTIVE") {
    res.status(400).json({ error: "This batch is no longer accepting delivery requests" });
    return;
  }

  const [farm] = await db
    .select()
    .from(farmsTable)
    .where(eq(farmsTable.id, batch.farmId));

  if (!farm) {
    res.status(404).json({ error: "Farm not found" });
    return;
  }

  const [request] = await db
    .insert(deliveryRequestsTable)
    .values({
      batchCode: String(batchCode),
      farmCode: farm.farmCode,
      farmId: farm.id,
      batchId: batch.id,
      buyerName: String(buyerName),
      buyerPhone: String(buyerPhone),
      state: String(state),
      lga: String(lga),
      town: String(town),
      streetAddress: String(streetAddress),
      marketArea: marketArea ? String(marketArea) : null,
      village: village ? String(village) : null,
      landmark: landmark ? String(landmark) : null,
      quantityCrates: Number(quantityCrates),
      notes: notes ? String(notes) : null,
      status: "PENDING",
    })
    .returning();

  res.status(201).json(request);
});

router.get("/admin/delivery-groups", requireAdmin, async (req, res): Promise<void> => {
  const requests = await db
    .select({
      id: deliveryRequestsTable.id,
      batchCode: deliveryRequestsTable.batchCode,
      farmCode: deliveryRequestsTable.farmCode,
      farmName: farmsTable.farmName,
      farmState: farmsTable.state,
      farmLga: farmsTable.lga,
      buyerName: deliveryRequestsTable.buyerName,
      buyerPhone: deliveryRequestsTable.buyerPhone,
      state: deliveryRequestsTable.state,
      lga: deliveryRequestsTable.lga,
      town: deliveryRequestsTable.town,
      streetAddress: deliveryRequestsTable.streetAddress,
      marketArea: deliveryRequestsTable.marketArea,
      village: deliveryRequestsTable.village,
      landmark: deliveryRequestsTable.landmark,
      quantityCrates: deliveryRequestsTable.quantityCrates,
      status: deliveryRequestsTable.status,
      notes: deliveryRequestsTable.notes,
      createdAt: deliveryRequestsTable.createdAt,
      eggSize: eggBatchesTable.eggSize,
      pricePerCrate: eggBatchesTable.pricePerCrate,
      collectionDate: eggBatchesTable.collectionDate,
    })
    .from(deliveryRequestsTable)
    .innerJoin(farmsTable, eq(farmsTable.id, deliveryRequestsTable.farmId))
    .innerJoin(eggBatchesTable, eq(eggBatchesTable.id, deliveryRequestsTable.batchId))
    .orderBy(
      deliveryRequestsTable.state,
      deliveryRequestsTable.farmCode,
      desc(deliveryRequestsTable.createdAt),
    );

  const groupMap = new Map<string, {
    groupKey: string;
    farmCode: string;
    farmName: string;
    farmState: string;
    farmLga: string;
    deliveryState: string;
    batchCode: string;
    eggSize: string;
    pricePerCrate: number;
    collectionDate: string;
    totalCrates: number;
    requests: typeof requests;
  }>();

  for (const r of requests) {
    const key = `${r.state}||${r.farmCode}||${r.batchCode}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        groupKey: key,
        farmCode: r.farmCode,
        farmName: r.farmName,
        farmState: r.farmState,
        farmLga: r.farmLga,
        deliveryState: r.state,
        batchCode: r.batchCode,
        eggSize: r.eggSize,
        pricePerCrate: Number(r.pricePerCrate),
        collectionDate: r.collectionDate,
        totalCrates: 0,
        requests: [],
      });
    }
    const group = groupMap.get(key)!;
    group.totalCrates += r.quantityCrates;
    group.requests.push(r);
  }

  res.json(Array.from(groupMap.values()));
});

router.patch("/admin/delivery-requests/:id/status", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { status } = req.body as { status: string };

  const valid = ["PENDING", "CONFIRMED", "DISPATCHED", "DELIVERED", "CANCELLED"];
  if (!valid.includes(status)) {
    res.status(400).json({ error: "Invalid status. Must be one of: " + valid.join(", ") });
    return;
  }

  const [updated] = await db
    .update(deliveryRequestsTable)
    .set({ status: status as "PENDING" | "CONFIRMED" | "DISPATCHED" | "DELIVERED" | "CANCELLED" })
    .where(eq(deliveryRequestsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Delivery request not found" });
    return;
  }

  res.json(updated);
});

export default router;
