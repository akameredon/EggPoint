import { db, farmsTable } from "@workspace/db";
import { count } from "drizzle-orm";

export function generateBatchCode(collectionDate: string): string {
  const datePart = collectionDate.replace(/-/g, "").slice(2);
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `EG${datePart}${seq}`;
}

export async function generateFarmCode(state: string, lga: string): Promise<string> {
  const stateCode = state.slice(0, 3).toUpperCase();
  const lgaCode = lga.slice(0, 3).toUpperCase();
  const [result] = await db.select({ total: count() }).from(farmsTable);
  const num = String((result?.total ?? 0) + 1).padStart(4, "0");
  return `${stateCode}-${lgaCode}-${num}`;
}

export function daysOld(collectionDate: string): number {
  const collected = new Date(collectionDate);
  const now = new Date();
  const diff = Math.floor((now.getTime() - collected.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}
