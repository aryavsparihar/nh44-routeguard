import pino from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateVAPIDKeys } from "web-push";
import type { PushStore } from "@/src/server/push/push.repository";

vi.mock("server-only", () => ({}));
vi.mock("@/src/server/db", () => ({ getWorkerDb: () => ({}) }));
const notify = vi.hoisted(() => ({ fanOut: vi.fn(), reportAlert: vi.fn(), updateAlert: vi.fn() }));
vi.mock("@/src/server/push/notify", () => notify);

const { makeHandlers } = await import("./handlers");

const log = pino({ level: "silent" });
const keys = generateVAPIDKeys();
const R1 = "6f1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b";
const U1 = "9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b";

function store(over: Partial<PushStore> = {}): PushStore {
  return {
    report: vi.fn(async () => ({ zone_id: 3, hazard_type: "landslide" })),
    update: vi.fn(async () => ({ zone_id: null, kind: "closure", title: "Closed", source_name: "TCU" })),
    targets: vi.fn(),
    markSent: vi.fn(),
    drop: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  notify.fanOut.mockReset().mockResolvedValue({ sent: 1, gone: 0, failed: 0 });
  vi.stubEnv("VAPID_PUBLIC_KEY", keys.publicKey);
  vi.stubEnv("VAPID_PRIVATE_KEY", keys.privateKey);
  vi.stubEnv("VAPID_SUBJECT", "mailto:team@example.com");
});
afterEach(() => vi.unstubAllEnvs());

describe("job handlers", () => {
  it("pushes a confirmed report to its zone, under one event key for created and confirmed", async () => {
    const h = makeHandlers(() => store());
    await h["report.created"]({ report_id: R1 }, { log });
    await h["report.confirmed"]({ report_id: R1 }, { log });
    expect(notify.fanOut).toHaveBeenCalledTimes(2);
    for (const call of notify.fanOut.mock.calls) {
      expect(call[2]).toBe(`report.confirmed:${R1}`);
      expect(call[3]).toBe(3);
    }
  });

  it("sends nothing for a report that isn't confirmed or is gone", async () => {
    const h = makeHandlers(() => store({ report: vi.fn(async () => null) }));
    await h["report.created"]({ report_id: R1 }, { log });
    expect(notify.fanOut).not.toHaveBeenCalled();
  });

  it("pushes an official update to its zone, or everyone for the whole road", async () => {
    const h = makeHandlers(() => store());
    await h["official_update.created"]({ update_id: U1 }, { log });
    expect(notify.fanOut.mock.calls[0][2]).toBe(`official_update.created:${U1}`);
    expect(notify.fanOut.mock.calls[0][3]).toBeNull();
  });

  it("does nothing (and doesn't fail the job) while push is off", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    const s = store();
    const h = makeHandlers(() => s);
    await h["report.confirmed"]({ report_id: R1 }, { log });
    await h["official_update.created"]({ update_id: U1 }, { log });
    expect(s.report).not.toHaveBeenCalled();
    expect(notify.fanOut).not.toHaveBeenCalled();
  });
});
