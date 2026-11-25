// GET /api/v1/risk/replays and /api/v1/risk/replays/{id}, on the real
// lib/risk/replays.json written by jobs/replay.py. No database.
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import data from "@/lib/risk/replays.json";
import backtest from "@/lib/risk/backtest.json";

vi.mock("@/src/server/http/caller", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/server/http/caller")>()),
  getCaller: async () => null,
}));
const db = vi.hoisted(() => ({ getDb: vi.fn(() => Promise.reject(new Error("no database here"))) }));
vi.mock("@/src/server/db", () => db);

const { GET: LIST } = await import("@/app/api/v1/risk/replays/route");
const { GET: ONE } = await import("@/app/api/v1/risk/replays/[id]/route");

const get = (path: string) => new NextRequest(`http://localhost:3000${path}`, { headers: { host: "localhost:3000" } });
const withId = (id: string) => ({ params: Promise.resolve({ id }) });
const NAVYUG = "inc-2026-01-23-z5-snow_ice";

describe("GET /api/v1/risk/replays", () => {
  it("lists the storms without their scores, from the file, with no database", async () => {
    const res = await LIST(get("/api/v1/risk/replays"), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    const body = await res.json();
    expect(body.meta).toMatchObject({ count: data.events.length, model_version: data.model_version });
    expect(body.meta.weather_source).toContain("ERA5");
    expect(body.data.map((e: { id: string }) => e.id)).toContain(NAVYUG);
    expect(body.data[0]).not.toHaveProperty("rows");
    expect(body.data[0]).not.toHaveProperty("hexes");
    expect(db.getDb).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/risk/replays/{id}", () => {
  it("returns zone rows for every horizon and cells with outlines for one", async () => {
    const res = await ONE(get(`/api/v1/risk/replays/${NAVYUG}?horizon=24`), withId(NAVYUG));
    expect(res.status).toBe(200);
    const { data: r } = await res.json();
    expect(r).toMatchObject({ id: NAVYUG, date: "2026-01-23", zone_id: 5, hazard: "snow_ice" });
    expect(new Set(r.rows.map((x: { horizon_hours: number }) => x.horizon_hours))).toEqual(new Set([0, 12, 24, 48]));
    expect(r.rows).toHaveLength(24); // 6 zones x 4 horizons
    expect(r.hexes.length).toBeGreaterThan(200);
    for (const h of r.hexes) {
      expect(h.boundary).toHaveLength(7);
      expect(h.boundary[0]).toEqual(h.boundary[6]);
      expect(h).toHaveProperty("hazards.snow_ice");
    }
    const ids = r.hexes.map((h: { h3_index: string }) => h.h3_index);
    expect(new Set(ids).size).toBe(ids.length); // one horizon only
  });

  it("matches the backtest's weather-on-the-day score for the incident's zone", async () => {
    for (const e of data.events) {
      const res = await ONE(get(`/api/v1/risk/replays/${e.id}`), withId(e.id));
      const { data: r } = await res.json();
      const zone = r.rows.find((x: { zone_id: number; horizon_hours: number }) => x.zone_id === e.zone_id && x.horizon_hours === 0);
      const bt = backtest.per_incident.find((x) => x.id === e.id);
      expect(bt?.on_the_day).not.toBeNull();
      expect(zone.overall).toBe(bt!.on_the_day!.overall);
      expect(zone.level).toBe(bt!.on_the_day!.level);
    }
  });

  it("answers 404 for an unknown or badly formed id, and 400 for a bad horizon", async () => {
    for (const id of ["inc-2026-01-01-z5-snow_ice", "../backtest", "x"]) {
      const res = await ONE(get(`/api/v1/risk/replays/${encodeURIComponent(id)}`), withId(id));
      expect(res.status).toBe(404);
      expect(res.headers.get("content-type")).toContain("application/problem+json");
    }
    expect((await ONE(get(`/api/v1/risk/replays/${NAVYUG}?horizon=6`), withId(NAVYUG))).status).toBe(400);
    expect((await ONE(get(`/api/v1/risk/replays/${NAVYUG}?zone=1`), withId(NAVYUG))).status).toBe(400);
  });
});
