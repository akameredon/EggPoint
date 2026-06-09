import { db, farmsTable, subscriptionsTable, usersTable } from "@workspace/db";
import { eq, and, lte, isNotNull } from "drizzle-orm";
import { logger } from "./logger";
import { sendFeaturedExpiryWarning, sendFeaturedExpiredNotice } from "./email";

const DAY_MS = 24 * 60 * 60 * 1000;
const WARNING_DAYS = 3;

async function runRenewalCheck(): Promise<void> {
  logger.info("Running subscription renewal check");

  const now = new Date();
  const warningThreshold = new Date(now.getTime() + WARNING_DAYS * DAY_MS);

  const featuredFarms = await db
    .select({
      farmId: farmsTable.id,
      farmName: farmsTable.farmName,
      farmCode: farmsTable.farmCode,
      featuredUntil: farmsTable.featuredUntil,
      ownerId: farmsTable.ownerId,
    })
    .from(farmsTable)
    .where(
      and(
        eq(farmsTable.subscriptionTier, "FEATURED"),
        isNotNull(farmsTable.featuredUntil),
      ),
    );

  for (const farm of featuredFarms) {
    if (!farm.featuredUntil) continue;

    const [owner] = await db
      .select({ email: usersTable.email, fullName: usersTable.fullName })
      .from(usersTable)
      .where(eq(usersTable.id, farm.ownerId));

    if (!owner) continue;

    if (farm.featuredUntil <= now) {
      logger.info({ farmCode: farm.farmCode }, "Downgrading expired FEATURED farm to FREE");

      await db
        .update(farmsTable)
        .set({ subscriptionTier: "FREE", featuredUntil: null })
        .where(eq(farmsTable.id, farm.farmId));

      await sendFeaturedExpiredNotice({
        toEmail: owner.email,
        toName: owner.fullName,
        farmName: farm.farmName,
      });
    } else if (farm.featuredUntil <= warningThreshold) {
      logger.info({ farmCode: farm.farmCode }, "Sending 3-day expiry warning");

      await sendFeaturedExpiryWarning({
        toEmail: owner.email,
        toName: owner.fullName,
        farmName: farm.farmName,
        expiresAt: farm.featuredUntil,
      });
    }
  }

  logger.info({ checked: featuredFarms.length }, "Renewal check complete");
}

export function startRenewalScheduler(): void {
  logger.info("Subscription renewal scheduler started (runs every 24h)");

  runRenewalCheck().catch((err) => {
    logger.error({ err }, "Initial renewal check failed");
  });

  setInterval(() => {
    runRenewalCheck().catch((err) => {
      logger.error({ err }, "Renewal check failed");
    });
  }, DAY_MS);
}
