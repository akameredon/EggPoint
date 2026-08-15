import { Router, type IRouter } from "express";
import { db, farmsTable, eggBatchesTable, deliveryRequestsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

function normalizeAddressToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function extractStreetAnchor(streetAddress: string): string {
  const tokens = normalizeAddressToken(streetAddress)
    .split(/\s+/)
    .filter(Boolean);
  const stopWords = new Set([
    "road", "rd", "street", "st", "avenue", "av", "lane", "ln", "close", "cl",
    "crescent", "cres", "drive", "dr", "way", "wy", "junction", "junc", "link",
    "lk", "court", "ct", "block", "plot", "house", "hse", "no", "number", "near",
    "next", "opposite", "beside", "by", "behind",
  ]);

  const significant = tokens.filter((token) => !stopWords.has(token));
  return significant.slice(0, 3).join(" ");
}

/** Haversine distance in km */
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Grid cell ~400m so nearby shops cluster on the same truck stop */
function geoCellKey(lat: number, lng: number, precision = 3): string {
  return `${lat.toFixed(precision)}|${lng.toFixed(precision)}`;
}

function buildProximityGroup(values: {
  state?: string | null;
  lga?: string | null;
  town?: string | null;
  marketArea?: string | null;
  village?: string | null;
  streetAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationLabel?: string | null;
}) {
  if (
    values.latitude != null &&
    values.longitude != null &&
    Number.isFinite(values.latitude) &&
    Number.isFinite(values.longitude)
  ) {
    const cell = geoCellKey(values.latitude, values.longitude);
    return {
      proximityGroupKey: `geo||${cell}`,
      proximityLabel:
        values.locationLabel ||
        `Pin ${values.latitude.toFixed(5)}, ${values.longitude.toFixed(5)}`,
      hasCoords: true as const,
    };
  }

  const location = [values.town, values.marketArea || values.village].filter(Boolean).join(" • ");
  const streetAnchor = extractStreetAnchor(values.streetAddress || "");
  const proximityLabel = [location, streetAnchor].filter(Boolean).join(" • ");
  const proximityGroupKey = [
    normalizeAddressToken(values.state ?? ""),
    normalizeAddressToken(values.lga ?? ""),
    normalizeAddressToken(values.town ?? ""),
    normalizeAddressToken(values.marketArea ?? ""),
    normalizeAddressToken(values.village ?? ""),
    streetAnchor,
  ]
    .filter(Boolean)
    .join("||");

  return {
    proximityGroupKey: proximityGroupKey || "unknown",
    proximityLabel: proximityLabel || "Nearby delivery zone",
    hasCoords: false as const,
  };
}

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
    latitude,
    longitude,
    locationSource,
    locationLabel,
  } = req.body as Record<string, string | number | null | undefined>;

  if (!batchCode || !buyerName || !buyerPhone || !quantityCrates) {
    res.status(400).json({
      error: "Missing required fields: batchCode, buyerName, buyerPhone, quantityCrates",
    });
    return;
  }

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

  // Need either GPS/map pin OR classic address fields
  if (!hasCoords) {
    if (!state || !lga || !town || !streetAddress) {
      res.status(400).json({
        error:
          "Provide GPS coordinates (latitude + longitude) or full address (state, lga, town, streetAddress)",
      });
      return;
    }
  }

  if (hasCoords && (Math.abs(lat!) > 90 || Math.abs(lng!) > 180)) {
    res.status(400).json({ error: "Invalid coordinates" });
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

  const [farm] = await db.select().from(farmsTable).where(eq(farmsTable.id, batch.farmId));

  if (!farm) {
    res.status(404).json({ error: "Farm not found" });
    return;
  }

  const source =
    locationSource === "gps" || locationSource === "map" || locationSource === "manual"
      ? locationSource
      : hasCoords
        ? "gps"
        : "manual";

  const proximity = buildProximityGroup({
    state: state ? String(state) : null,
    lga: lga ? String(lga) : null,
    town: town ? String(town) : null,
    marketArea: marketArea ? String(marketArea) : null,
    village: village ? String(village) : null,
    streetAddress: streetAddress ? String(streetAddress) : null,
    latitude: hasCoords ? lat : null,
    longitude: hasCoords ? lng : null,
    locationLabel: locationLabel ? String(locationLabel) : null,
  });

  const [request] = await db
    .insert(deliveryRequestsTable)
    .values({
      batchCode: String(batchCode),
      farmCode: farm.farmCode,
      farmId: farm.id,
      batchId: batch.id,
      buyerName: String(buyerName),
      buyerPhone: String(buyerPhone),
      state: state ? String(state) : null,
      lga: lga ? String(lga) : null,
      town: town ? String(town) : null,
      streetAddress: streetAddress ? String(streetAddress) : null,
      marketArea: marketArea ? String(marketArea) : null,
      village: village ? String(village) : null,
      landmark: landmark ? String(landmark) : null,
      latitude: hasCoords ? lat : null,
      longitude: hasCoords ? lng : null,
      locationSource: source,
      locationLabel: locationLabel ? String(locationLabel) : proximity.proximityLabel,
      quantityCrates: Number(quantityCrates),
      notes: notes ? String(notes) : null,
      status: "PENDING",
    })
    .returning();

  res.status(201).json({
    ...request,
    proximityGroupKey: proximity.proximityGroupKey,
    proximityLabel: proximity.proximityLabel,
  });
});

router.get("/admin/delivery-groups", requireAdmin, async (_req, res): Promise<void> => {
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
      latitude: deliveryRequestsTable.latitude,
      longitude: deliveryRequestsTable.longitude,
      locationSource: deliveryRequestsTable.locationSource,
      locationLabel: deliveryRequestsTable.locationLabel,
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
    .orderBy(desc(deliveryRequestsTable.createdAt));

  const groupMap = new Map<
    string,
    {
      groupKey: string;
      farmCode: string;
      farmName: string;
      farmState: string;
      farmLga: string;
      deliveryState: string | null;
      batchCode: string;
      eggSize: string;
      pricePerCrate: number;
      collectionDate: string;
      totalCrates: number;
      proximityLabel: string;
      hasCoords: boolean;
      centerLat: number | null;
      centerLng: number | null;
      requests: typeof requests;
    }
  >();

  for (const r of requests) {
    const proximity = buildProximityGroup({
      state: r.state,
      lga: r.lga,
      town: r.town,
      marketArea: r.marketArea,
      village: r.village,
      streetAddress: r.streetAddress,
      latitude: r.latitude,
      longitude: r.longitude,
      locationLabel: r.locationLabel,
    });
    const key = `${proximity.proximityGroupKey}||${r.farmCode}||${r.batchCode}`;
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
        proximityLabel: proximity.proximityLabel,
        hasCoords: proximity.hasCoords,
        centerLat: r.latitude,
        centerLng: r.longitude,
        requests: [],
      });
    }
    const group = groupMap.get(key)!;
    group.totalCrates += r.quantityCrates;
    group.requests.push(r);
    if (r.latitude != null && r.longitude != null) {
      // Running average of pins in the cell
      const n = group.requests.filter((x) => x.latitude != null).length;
      group.centerLat =
        group.centerLat == null ? r.latitude : (group.centerLat * (n - 1) + r.latitude) / n;
      group.centerLng =
        group.centerLng == null ? r.longitude : (group.centerLng * (n - 1) + r.longitude) / n;
    }
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
