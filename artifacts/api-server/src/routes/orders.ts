import { Router, type IRouter } from "express";
import { randomBytes } from "crypto";
import {
  db,
  farmsTable,
  eggBatchesTable,
  ordersTable,
  referralCodesTable,
  referralEventsTable,
} from "@workspace/db";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || "";

function orderCode(): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = randomBytes(3).toString("hex").toUpperCase();
  return `EP-${t}-${r}`;
}

function token(): string {
  return randomBytes(24).toString("hex");
}

function geoCellKey(lat: number, lng: number, precision = 3): string {
  return `${lat.toFixed(precision)}|${lng.toFixed(precision)}`;
}

function getAppBase(): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domains) return `https://${domains}`;
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  return "http://localhost:80";
}

function publicOrderView(o: typeof ordersTable.$inferSelect) {
  return {
    id: o.id,
    orderCode: o.orderCode,
    batchCode: o.batchCode,
    farmCode: o.farmCode,
    buyerName: o.buyerName,
    buyerPhone: o.buyerPhone,
    quantityCrates: o.quantityCrates,
    unitPriceNgn: Number(o.unitPriceNgn),
    totalNgn: Number(o.totalNgn),
    payMethod: o.payMethod,
    status: o.status,
    locationLabel: o.locationLabel,
    latitude: o.latitude,
    longitude: o.longitude,
    pickupPointLabel: o.pickupPointLabel,
    pickupWindow: o.pickupWindow,
    driverConfirmedAt: o.driverConfirmedAt,
    buyerConfirmedAt: o.buyerConfirmedAt,
    paidAt: o.paidAt,
    createdAt: o.createdAt,
    buyerToken: o.buyerToken,
    referralCode: o.referralCode,
  };
}

/** Reserve crates on batch; mark SOLD_OUT at zero */
async function reserveStock(batchId: number, qty: number): Promise<boolean> {
  const [batch] = await db
    .select()
    .from(eggBatchesTable)
    .where(eq(eggBatchesTable.id, batchId));
  if (!batch || batch.status !== "ACTIVE" || batch.quantityCrates < qty) return false;

  const left = batch.quantityCrates - qty;
  await db
    .update(eggBatchesTable)
    .set({
      quantityCrates: left,
      status: left <= 0 ? "SOLD_OUT" : "ACTIVE",
    })
    .where(eq(eggBatchesTable.id, batchId));
  return true;
}

async function trackFirstOrderReferral(referralCode: string | null, orderCode: string) {
  if (!referralCode) return;
  const code = referralCode.toUpperCase().trim();
  if (!code) return;
  const [row] = await db
    .select()
    .from(referralCodesTable)
    .where(and(eq(referralCodesTable.code, code), eq(referralCodesTable.active, true)));
  if (!row) return;
  await db.insert(referralEventsTable).values({
    codeId: row.id,
    eventType: "FIRST_ORDER",
    meta: JSON.stringify({ orderCode }),
  });
}

router.post("/orders", async (req, res): Promise<void> => {
  const {
    batchCode,
    buyerName,
    buyerPhone,
    buyerEmail,
    quantityCrates,
    payMethod,
    latitude,
    longitude,
    locationSource,
    locationLabel,
    state,
    lga,
    town,
    streetAddress,
    notes,
    referralCode,
  } = req.body as Record<string, string | number | null | undefined>;

  if (!batchCode || !buyerName || !buyerPhone || !quantityCrates) {
    res.status(400).json({
      error: "batchCode, buyerName, buyerPhone, quantityCrates are required",
    });
    return;
  }

  const qty = Number(quantityCrates);
  if (!Number.isFinite(qty) || qty < 1) {
    res.status(400).json({ error: "quantityCrates must be >= 1" });
    return;
  }

  const method = payMethod === "COD" ? "COD" : "ONLINE";

  const lat =
    latitude === null || latitude === undefined || latitude === ""
      ? null
      : Number(latitude);
  const lng =
    longitude === null || longitude === undefined || longitude === ""
      ? null
      : Number(longitude);
  const hasCoords =
    lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

  if (!hasCoords) {
    res.status(400).json({ error: "GPS or map pin required (latitude + longitude)" });
    return;
  }

  const [batch] = await db
    .select()
    .from(eggBatchesTable)
    .where(eq(eggBatchesTable.batchCode, String(batchCode)));

  if (!batch || batch.status !== "ACTIVE") {
    res.status(400).json({ error: "Batch not available" });
    return;
  }

  if (qty > batch.quantityCrates) {
    res.status(400).json({
      error: `Only ${batch.quantityCrates} crates available on this batch`,
    });
    return;
  }

  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, batch.farmId));
  if (!farm) {
    res.status(404).json({ error: "Farm not found" });
    return;
  }

  const unit = Number(batch.pricePerCrate);
  const total = unit * qty;
  const code = orderCode();
  const buyerTok = token();
  const driverTok = token();
  const groupKey = `geo||${geoCellKey(lat!, lng!)}||${farm.farmCode}||${batch.batchCode}`;
  const source =
    locationSource === "gps" || locationSource === "map" || locationSource === "manual"
      ? locationSource
      : "gps";
  const ref =
    referralCode && String(referralCode).trim()
      ? String(referralCode).toUpperCase().trim()
      : null;

  const baseValues = {
    orderCode: code,
    batchId: batch.id,
    farmId: farm.id,
    batchCode: batch.batchCode,
    farmCode: farm.farmCode,
    buyerName: String(buyerName),
    buyerPhone: String(buyerPhone),
    buyerEmail: buyerEmail ? String(buyerEmail) : null,
    quantityCrates: qty,
    unitPriceNgn: String(unit),
    totalNgn: String(total),
    latitude: lat,
    longitude: lng,
    locationSource: source as "gps" | "map" | "manual",
    locationLabel: locationLabel ? String(locationLabel) : null,
    state: state ? String(state) : null,
    lga: lga ? String(lga) : null,
    town: town ? String(town) : null,
    streetAddress: streetAddress ? String(streetAddress) : null,
    dispatchGroupKey: groupKey,
    driverToken: driverTok,
    buyerToken: buyerTok,
    referralCode: ref,
    notes: notes ? String(notes) : null,
  };

  if (method === "COD") {
    const ok = await reserveStock(batch.id, qty);
    if (!ok) {
      res.status(400).json({ error: "Not enough stock" });
      return;
    }

    const [order] = await db
      .insert(ordersTable)
      .values({
        ...baseValues,
        payMethod: "COD",
        status: "COD",
        stockReserved: qty,
      })
      .returning();

    res.status(201).json({
      order: publicOrderView(order),
      trackUrl: `${getAppBase()}/order/${buyerTok}`,
      paymentLink: null,
    });
    return;
  }

  if (!FLW_SECRET_KEY) {
    res.status(503).json({
      error: "Online payments not configured. Set FLW_SECRET_KEY or use payMethod COD.",
    });
    return;
  }

  const txRef = `EGG-${code}`;

  const [order] = await db
    .insert(ordersTable)
    .values({
      ...baseValues,
      payMethod: "ONLINE",
      status: "PENDING_PAYMENT",
      flwTxRef: txRef,
      stockReserved: 0,
    })
    .returning();

  const redirectUrl = `${getAppBase()}/order/${buyerTok}?payment=return`;

  const payload = {
    tx_ref: txRef,
    amount: total,
    currency: "NGN",
    redirect_url: redirectUrl,
    meta: { order_code: code, type: "egg_order" },
    customer: {
      email: buyerEmail
        ? String(buyerEmail)
        : `order-${code.toLowerCase()}@eggpoint.ng`,
      phonenumber: String(buyerPhone),
      name: String(buyerName),
    },
    customizations: {
      title: "EggPoint Egg Order",
      description: `${qty} crate(s) · ${batch.eggSize} · ${farm.farmName}`,
      logo: "https://eggpoint.ng/logo.png",
    },
  };

  const flwRes = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FLW_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const flwData = (await flwRes.json()) as {
    status: string;
    data?: { link: string };
    message?: string;
  };

  if (flwData.status !== "success" || !flwData.data?.link) {
    await db
      .update(ordersTable)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(eq(ordersTable.id, order.id));
    res.status(502).json({
      error: flwData.message || "Could not create payment link. Try COD or retry.",
    });
    return;
  }

  res.status(201).json({
    order: publicOrderView(order),
    trackUrl: `${getAppBase()}/order/${buyerTok}`,
    paymentLink: flwData.data.link,
  });
});

router.post("/orders/verify-payment", async (req, res): Promise<void> => {
  const { transactionId, txRef, buyerToken } = req.body as {
    transactionId?: string;
    txRef?: string;
    buyerToken?: string;
  };

  if (!transactionId) {
    res.status(400).json({ error: "transactionId required" });
    return;
  }

  if (!FLW_SECRET_KEY) {
    res.status(503).json({ error: "Payments not configured" });
    return;
  }

  const flwRes = await fetch(
    `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
    { headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` } }
  );

  const data = (await flwRes.json()) as {
    status: string;
    data?: {
      status: string;
      tx_ref: string;
      amount: number;
      currency: string;
    };
  };

  if (
    data.status !== "success" ||
    data.data?.status !== "successful" ||
    data.data?.currency !== "NGN"
  ) {
    res.status(400).json({ error: "Payment could not be verified" });
    return;
  }

  const ref = txRef || data.data.tx_ref;

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(
      buyerToken
        ? and(eq(ordersTable.flwTxRef, ref), eq(ordersTable.buyerToken, buyerToken))
        : eq(ordersTable.flwTxRef, ref)
    );

  if (!order) {
    res.status(404).json({ error: "Order not found for this payment" });
    return;
  }

  if (Number(data.data.amount) + 0.01 < Number(order.totalNgn)) {
    res.status(400).json({ error: "Paid amount too low" });
    return;
  }

  if (order.status === "PENDING_PAYMENT") {
    const ok = await reserveStock(order.batchId, order.quantityCrates);
    if (!ok) {
      res.status(409).json({
        error: "Payment ok but stock gone — contact support for refund",
      });
      return;
    }

    await db
      .update(ordersTable)
      .set({
        status: "PAID",
        flwTxId: String(transactionId),
        paidAt: new Date(),
        stockReserved: order.quantityCrates,
        updatedAt: new Date(),
      })
      .where(eq(ordersTable.id, order.id));
  }

  const [updated] = await db.select().from(ordersTable).where(eq(ordersTable.id, order.id));
  res.json({ success: true, order: publicOrderView(updated) });
});

router.get("/orders/by-token/:buyerToken", async (req, res): Promise<void> => {
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.buyerToken, String(req.params.buyerToken)));

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, order.farmId));
  const [batch] = await db
    .select()
    .from(eggBatchesTable)
    .where(eq(eggBatchesTable.id, order.batchId));

  res.json({
    order: publicOrderView(order),
    farmName: farm?.farmName,
    eggSize: batch?.eggSize,
  });
});

router.post("/orders/by-token/:buyerToken/confirm-pickup", async (req, res): Promise<void> => {
  const note = (req.body as { note?: string })?.note;

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.buyerToken, String(req.params.buyerToken)));

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (["CANCELLED", "REFUNDED", "COMPLETED"].includes(order.status)) {
    res.status(400).json({ error: `Order is ${order.status}` });
    return;
  }

  if (!["DISPATCHED", "AWAITING_PICKUP", "GROUPED", "PAID", "COD"].includes(order.status)) {
    res.status(400).json({ error: "Pickup not open yet" });
    return;
  }

  const buyerConfirmedAt = order.buyerConfirmedAt || new Date();
  const becameComplete = Boolean(order.driverConfirmedAt);

  const [updated] = await db
    .update(ordersTable)
    .set({
      buyerConfirmedAt,
      buyerNote: note ? String(note) : order.buyerNote,
      status: becameComplete
        ? "COMPLETED"
        : order.status === "DISPATCHED"
          ? "AWAITING_PICKUP"
          : order.status,
      updatedAt: new Date(),
    })
    .where(eq(ordersTable.id, order.id))
    .returning();

  if (becameComplete && order.status !== "COMPLETED") {
    await trackFirstOrderReferral(order.referralCode, order.orderCode);
  }

  res.json({
    order: publicOrderView(updated),
    dualComplete: Boolean(updated.driverConfirmedAt && updated.buyerConfirmedAt),
  });
});

router.get("/orders/driver/:driverToken", async (req, res): Promise<void> => {
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.driverToken, String(req.params.driverToken)));

  if (!order) {
    res.status(404).json({ error: "Stop not found" });
    return;
  }

  res.json({
    orderCode: order.orderCode,
    buyerName: order.buyerName,
    buyerPhone: order.buyerPhone,
    quantityCrates: order.quantityCrates,
    locationLabel: order.locationLabel,
    latitude: order.latitude,
    longitude: order.longitude,
    pickupPointLabel: order.pickupPointLabel,
    status: order.status,
    driverConfirmedAt: order.driverConfirmedAt,
    buyerConfirmedAt: order.buyerConfirmedAt,
    totalNgn: Number(order.totalNgn),
    payMethod: order.payMethod,
  });
});

router.post("/orders/driver/:driverToken/confirm-handover", async (req, res): Promise<void> => {
  const note = (req.body as { note?: string })?.note;

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.driverToken, String(req.params.driverToken)));

  if (!order) {
    res.status(404).json({ error: "Stop not found" });
    return;
  }

  if (["CANCELLED", "REFUNDED", "COMPLETED"].includes(order.status)) {
    res.status(400).json({ error: `Order is ${order.status}` });
    return;
  }

  if (!["PAID", "COD", "GROUPED", "DISPATCHED", "AWAITING_PICKUP"].includes(order.status)) {
    res.status(400).json({ error: "Order not ready for handover" });
    return;
  }

  const driverConfirmedAt = order.driverConfirmedAt || new Date();
  const complete = Boolean(order.buyerConfirmedAt);

  const [updated] = await db
    .update(ordersTable)
    .set({
      driverConfirmedAt,
      driverNote: note ? String(note) : order.driverNote,
      status: complete ? "COMPLETED" : "AWAITING_PICKUP",
      updatedAt: new Date(),
    })
    .where(eq(ordersTable.id, order.id))
    .returning();

  if (complete && order.status !== "COMPLETED") {
    await trackFirstOrderReferral(order.referralCode, order.orderCode);
  }

  res.json({
    ok: true,
    dualComplete: Boolean(updated.driverConfirmedAt && updated.buyerConfirmedAt),
    status: updated.status,
  });
});

router.get("/admin/orders", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      order: ordersTable,
      farmName: farmsTable.farmName,
      eggSize: eggBatchesTable.eggSize,
    })
    .from(ordersTable)
    .innerJoin(farmsTable, eq(farmsTable.id, ordersTable.farmId))
    .innerJoin(eggBatchesTable, eq(eggBatchesTable.id, ordersTable.batchId))
    .orderBy(desc(ordersTable.createdAt))
    .limit(500);

  res.json(
    rows.map((r) => ({
      ...publicOrderView(r.order),
      farmName: r.farmName,
      eggSize: r.eggSize,
      driverToken: r.order.driverToken,
      dispatchGroupKey: r.order.dispatchGroupKey,
      driverUrl: r.order.driverToken
        ? `${getAppBase()}/driver/${r.order.driverToken}`
        : null,
      trackUrl: `${getAppBase()}/order/${r.order.buyerToken}`,
    }))
  );
});

router.get("/admin/order-groups", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(ordersTable)
    .where(
      inArray(ordersTable.status, [
        "PAID",
        "COD",
        "GROUPED",
        "DISPATCHED",
        "AWAITING_PICKUP",
      ])
    )
    .orderBy(desc(ordersTable.createdAt));

  const map = new Map<
    string,
    {
      groupKey: string;
      totalCrates: number;
      orderCount: number;
      label: string;
      centerLat: number | null;
      centerLng: number | null;
      orders: ReturnType<typeof publicOrderView>[];
      driverLinks: { orderCode: string; url: string; buyerName: string }[];
    }
  >();

  for (const o of rows) {
    const key = o.dispatchGroupKey || `solo||${o.orderCode}`;
    if (!map.has(key)) {
      map.set(key, {
        groupKey: key,
        totalCrates: 0,
        orderCount: 0,
        label: o.locationLabel || o.pickupPointLabel || key,
        centerLat: o.latitude,
        centerLng: o.longitude,
        orders: [],
        driverLinks: [],
      });
    }
    const g = map.get(key)!;
    g.totalCrates += o.quantityCrates;
    g.orderCount += 1;
    g.orders.push(publicOrderView(o));
    if (o.driverToken) {
      g.driverLinks.push({
        orderCode: o.orderCode,
        buyerName: o.buyerName,
        url: `${getAppBase()}/driver/${o.driverToken}`,
      });
    }
  }

  res.json(Array.from(map.values()));
});

router.post("/admin/order-groups/dispatch", requireAdmin, async (req, res): Promise<void> => {
  const { groupKey, pickupPointLabel, pickupWindow } = req.body as {
    groupKey?: string;
    pickupPointLabel?: string;
    pickupWindow?: string;
  };

  if (!groupKey) {
    res.status(400).json({ error: "groupKey required" });
    return;
  }

  const updated = await db
    .update(ordersTable)
    .set({
      status: "DISPATCHED",
      pickupPointLabel: pickupPointLabel || null,
      pickupWindow: pickupWindow || null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(ordersTable.dispatchGroupKey, groupKey),
        inArray(ordersTable.status, ["PAID", "COD", "GROUPED"])
      )
    )
    .returning();

  res.json({ updated: updated.length, orders: updated.map(publicOrderView) });
});

export default router;
