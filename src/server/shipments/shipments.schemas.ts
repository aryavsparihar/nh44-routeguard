// Shipments (D4): bodies and query strings for /api/v1/shipments. Ranges as
// in the app (BUILD_PROMPT section 6): tonnes 0.1–40, harvest not in the
// future and at most 120 days ago, truck numbers normalised.
import { z } from "zod";
import { cleanText, truckNumber } from "@/src/server/schemas/common";
import { DESTINATIONS, VARIETIES } from "@/src/shared/priority";

export const SHIPMENT_STATUSES = ["planned", "holding", "moving", "stuck", "on_rail", "diverted", "delivered"] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const shipmentId = z.uuid();

// A Clerk user id, as the API and database store it.
export const userId = z.string().regex(/^user_[A-Za-z0-9]{6,60}$/, "Not a user id.");

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;

// Today's date in India, as YYYY-MM-DD.
export function istToday(now = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// Whole days from the harvest date to today (India time).
export function daysSincePicking(harvestDate: string, now = new Date()): number {
  return Math.round((Date.parse(istToday(now)) - Date.parse(harvestDate)) / DAY_MS);
}

const harvestDate = z.iso
  .date("Use a date like 2026-11-20.")
  .refine((d) => daysSincePicking(d) >= 0, "The harvest date can't be in the future.")
  .refine((d) => daysSincePicking(d) <= 120, "The harvest date can't be more than 120 days ago.");

const eta = z.iso.datetime({ offset: true, message: "Use an ISO date and time with a time zone." });

export const createShipmentBody = z
  .object({
    variety: z.enum(VARIETIES as [string, ...string[]]),
    harvest_date: harvestDate,
    tonnes: z.number().min(0.1).max(40),
    destination: z.enum(DESTINATIONS as [string, ...string[]]),
    truck_type: z.enum(["light", "heavy"]),
    truck_number: truckNumber.optional(),
    origin: cleanText(80).optional(),
    cold_stored: z.boolean().optional(),
    // Agents only (the route checks): a driver from their own fleet, and when
    // the truck should arrive.
    driver_id: userId.optional(),
    eta: eta.optional(),
  })
  .strict();
export type CreateShipmentInput = z.infer<typeof createShipmentBody>;

export const patchShipmentBody = z
  .object({
    status: z.enum(SHIPMENT_STATUSES).optional(),
    driver_id: userId.nullable().optional(),
    eta: eta.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Send at least one of status, driver_id or eta." });
export type PatchShipmentInput = z.infer<typeof patchShipmentBody>;

// Where the truck is. A shipment goes to Delhi or Mumbai too, so this is the
// India box, not the corridor box. Stored rounded to about 1 km.
const OUTSIDE_INDIA = "outside India";
export const locationBody = z
  .object({
    lat: z.number().min(6, OUTSIDE_INDIA).max(37.5, OUTSIDE_INDIA),
    lng: z.number().min(68, OUTSIDE_INDIA).max(98, OUTSIDE_INDIA),
  })
  .strict();

export const shipmentsQuery = z
  .object({
    status: z.enum(SHIPMENT_STATUSES).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z
      .string()
      .regex(/^\d{1,15}_[0-9a-f-]{36}$/, "Not a cursor from this API.")
      .transform((c) => {
        const [ms, id] = c.split("_");
        return { createdAt: new Date(Number(ms)), id };
      })
      .optional(),
  })
  .strict();
