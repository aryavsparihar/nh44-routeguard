// GET /api/v1/model: the model card from lib/risk/config.json plus the
// backtest from lib/risk/backtest.json.
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import backtest from "@/lib/risk/backtest.json";
import config from "@/lib/risk/config.json";

vi.mock("@/src/server/http/caller", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/server/http/caller")>()),
  getCaller: async () => null,
}));

const { GET } = await import("@/app/api/v1/model/route");
const request = new NextRequest("http://localhost:3000/api/v1/model", { headers: { host: "localhost:3000" } });
const noParams = { params: Promise.resolve({}) };

describe("GET /api/v1/model", () => {
  it("returns the card from the job's own settings, cacheable for 5 minutes", async () => {
    const res = await GET(request, noParams);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
    const { data } = await res.json();
    expect(data.model_version).toBe(config.model_version);
    expect(data.horizons_hours).toEqual(config.horizons_hours);
    expect(data.levels).toEqual({ medium_from: config.levels.medium_from, high_above: config.levels.high_above });
    expect(data.thresholds_note).toContain("not sourced");
    expect(data.advisory).toContain("not an official police service");
  });

  it("passes the backtest file through as it is", async () => {
    const { data } = await (await GET(request, noParams)).json();
    expect(data.backtest).toEqual(backtest);
    expect(["not_run", "ok"]).toContain(data.backtest.status);
    expect(data.backtest.preview_unverified).toBe(false); // a preview is never committed
  });
});
