import { Router, type IRouter } from "express";
import { db, farmsTable, subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

const FEATURED_PRICE_NGN = 15000;
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY!;
const FLW_PUBLIC_KEY = process.env.FLW_PUBLIC_KEY!;

function getRedirectUrl(): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0];
  const base = domains ? `https://${domains}` : "http://localhost:80";
  return `${base}/dashboard?payment=complete`;
}

router.post("/payments/initiate", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const [farm] = await db
    .select()
    .from(farmsTable)
    .where(eq(farmsTable.ownerId, userId));

  if (!farm) {
    res.status(400).json({ error: "No farm found for your account" });
    return;
  }

  if (farm.subscriptionTier === "FEATURED") {
    res.status(400).json({ error: "Your farm is already on the Featured plan" });
    return;
  }

  const txRef = `EP-${farm.farmCode}-${Date.now()}`;

  await db.insert(subscriptionsTable).values({
    farmId: farm.id,
    flwTxRef: txRef,
    amountNgn: FEATURED_PRICE_NGN,
    status: "PENDING",
  });

  const payload = {
    tx_ref: txRef,
    amount: FEATURED_PRICE_NGN,
    currency: "NGN",
    redirect_url: getRedirectUrl(),
    meta: { farm_code: farm.farmCode },
    customer: {
      email: `farm-${farm.farmCode.toLowerCase()}@eggpoint.ng`,
      name: farm.farmName,
    },
    customizations: {
      title: "Eggpoint Featured Listing",
      description: `Upgrade ${farm.farmName} to Featured — appear at the top of search results`,
      logo: "https://eggpoint.ng/logo.png",
    },
  };

  const response = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FLW_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json() as { status: string; data?: { link: string } };

  if (data.status !== "success" || !data.data?.link) {
    req.log.error({ data }, "Flutterwave payment initiation failed");
    res.status(500).json({ error: "Could not create payment link. Please try again." });
    return;
  }

  res.json({ paymentLink: data.data.link, txRef });
});

router.post("/payments/verify", requireAuth, async (req, res): Promise<void> => {
  const { txRef, transactionId } = req.body as { txRef: string; transactionId: string };

  if (!txRef || !transactionId) {
    res.status(400).json({ error: "txRef and transactionId are required" });
    return;
  }

  const response = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
    headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` },
  });

  const data = await response.json() as {
    status: string;
    data?: { status: string; tx_ref: string; amount: number; currency: string };
  };

  if (
    data.status !== "success" ||
    data.data?.status !== "successful" ||
    data.data?.tx_ref !== txRef ||
    data.data?.currency !== "NGN" ||
    data.data?.amount < FEATURED_PRICE_NGN
  ) {
    req.log.warn({ txRef, transactionId, data }, "Payment verification failed");
    res.status(400).json({ error: "Payment could not be verified" });
    return;
  }

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.flwTxRef, txRef));

  if (!sub) {
    res.status(400).json({ error: "Transaction reference not found" });
    return;
  }

  await db
    .update(subscriptionsTable)
    .set({ status: "COMPLETED", flwTxId: transactionId, completedAt: new Date() })
    .where(eq(subscriptionsTable.flwTxRef, txRef));

  await db
    .update(farmsTable)
    .set({ subscriptionTier: "FEATURED" })
    .where(eq(farmsTable.id, sub.farmId));

  res.json({ success: true, message: "Your farm has been upgraded to Featured!" });
});

export default router;
