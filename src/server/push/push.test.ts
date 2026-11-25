import pino from "pino";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateVAPIDKeys } from "web-push";
import { pushConfig } from "./config";
import { fanOut, reportAlert, updateAlert, type Sender } from "./notify";
import type { PushStore, PushTarget } from "./push.repository";
import { isPushEndpoint, subscriptionBody } from "./push.schemas";

vi.mock("server-only", () => ({}));

const log = pino({ level: "silent" });
const keys = generateVAPIDKeys();
const P256 = "B".padEnd(87, "A");
const AUTH = "a".repeat(22);

afterEach(() => vi.unstubAllEnvs());

describe("isPushEndpoint", () => {
  it("accepts the browsers' push services", () => {
    for (const url of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/QGabc",
      "https://api.push.apple.com/3/device/abc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) {
      expect(isPushEndpoint(url), url).toBe(true);
    }
  });

  it("refuses anything else, so the worker can't be pointed at any address", () => {
    for (const url of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com.evil.example/x",
      "https://evil.example/fcm.googleapis.com",
      "https://push.apple.com/x",
      "https://user:pw@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "https://127.0.0.1/x",
      "https://localhost/x",
      "https://169.254.169.254/latest/meta-data",
      "not a url",
    ]) {
      expect(isPushEndpoint(url), url).toBe(false);
    }
  });
});

describe("subscriptionBody", () => {
  const ok = { endpoint: "https://fcm.googleapis.com/fcm/send/abc123", keys: { p256dh: P256, auth: AUTH }, zones: [3, 4], language: "hi" };

  it("accepts what the browser gives plus zones and language", () => {
    expect(subscriptionBody.safeParse(ok).success).toBe(true);
  });

  it("refuses unknown fields, bad keys, no zones and other languages", () => {
    expect(subscriptionBody.safeParse({ ...ok, expirationTime: null }).success).toBe(false);
    expect(subscriptionBody.safeParse({ ...ok, keys: { p256dh: "short", auth: AUTH } }).success).toBe(false);
    expect(subscriptionBody.safeParse({ ...ok, keys: { p256dh: P256, auth: "a+b/".repeat(6) } }).success).toBe(false);
    expect(subscriptionBody.safeParse({ ...ok, zones: [] }).success).toBe(false);
    expect(subscriptionBody.safeParse({ ...ok, zones: [0] }).success).toBe(false);
    expect(subscriptionBody.safeParse({ ...ok, language: "fr" }).success).toBe(false);
    expect(subscriptionBody.safeParse({ ...ok, endpoint: "https://evil.example/push/abc" }).success).toBe(false);
  });
});

describe("pushConfig", () => {
  it("is on with valid VAPID keys and a contact", () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", keys.publicKey);
    vi.stubEnv("VAPID_PRIVATE_KEY", keys.privateKey);
    vi.stubEnv("VAPID_SUBJECT", "mailto:team@example.com");
    expect(pushConfig()).toEqual({ publicKey: keys.publicKey, privateKey: keys.privateKey, subject: "mailto:team@example.com" });
    vi.stubEnv("FEATURE_PUSH", "false");
    expect(pushConfig()).toBeNull();
  });

  it("is off when a value is missing or malformed", () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", keys.publicKey);
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    vi.stubEnv("VAPID_SUBJECT", "mailto:team@example.com");
    expect(pushConfig()).toBeNull();
    vi.stubEnv("VAPID_PRIVATE_KEY", keys.privateKey);
    vi.stubEnv("VAPID_SUBJECT", "team@example.com");
    expect(pushConfig()).toBeNull();
  });
});

describe("alert text", () => {
  it("names the hazard and zone in the browser's language", () => {
    const r = { id: "r1", zone_id: 3, hazard_type: "landslide" };
    expect(reportAlert("en", r)).toEqual({
      title: "Confirmed: Landslide in zone 3",
      body: expect.stringContaining("not an official police service"),
      url: "/",
      tag: "report-r1",
    });
    expect(reportAlert("hi", r).title).toContain("ज़ोन 3");
    expect(reportAlert("ur", r).title).toContain("زون 3");
    expect(reportAlert("fr", r).title).toBe("Confirmed: Landslide in zone 3");
    expect(reportAlert("en", { ...r, zone_id: null }).title).toBe("Confirmed: Landslide on NH-44");
  });

  it("gives an update's kind, title, place and source", () => {
    const u = { id: "u1", zone_id: null, kind: "closure", title: "NH-44 closed at Digdol", source_name: "J&K Traffic Police" };
    const a = updateAlert("en", u);
    expect(a.title).toBe("Closure: NH-44 closed at Digdol");
    expect(a.body).toBe("Whole road. From J&K Traffic Police. Check the source before you act.");
    expect(a.url).toBe("/status");
  });
});

function fakeStore(targets: PushTarget[]) {
  const dropped: string[] = [];
  const marked: string[] = [];
  const store: PushStore = {
    report: vi.fn(),
    update: vi.fn(),
    targets: vi.fn(async () => targets),
    markSent: vi.fn(async (k) => void marked.push(k)),
    drop: vi.fn(async (e) => void dropped.push(e)),
  };
  return { store, dropped, marked };
}

const target = (n: number, language = "en"): PushTarget => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/t${n}`,
  keys: { p256dh: P256, auth: AUTH },
  language,
});
const config = { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: "mailto:team@example.com" };
const alertFor = (language: string) => ({ title: language, body: "", url: "/", tag: "t" });

describe("fanOut", () => {
  it("sends to every target in its language and marks the event sent", async () => {
    const { store, marked } = fakeStore(Array.from({ length: 45 }, (_, i) => target(i, i % 2 ? "hi" : "en")));
    const seen: string[] = [];
    const send: Sender = async (_t, alert) => void seen.push(alert.title);
    const result = await fanOut(store, config, "report.confirmed:r1", 3, alertFor, log, send);
    expect(result).toEqual({ sent: 45, gone: 0, failed: 0 });
    expect(new Set(seen)).toEqual(new Set(["en", "hi"]));
    expect(marked).toEqual(["report.confirmed:r1"]);
  });

  it("drops browsers the push service says are gone", async () => {
    const { store, dropped, marked } = fakeStore([target(1), target(2)]);
    const send: Sender = async (t) => {
      if (t.endpoint.endsWith("t1")) throw Object.assign(new Error("gone"), { statusCode: 410 });
    };
    expect(await fanOut(store, config, "e", 3, alertFor, log, send)).toEqual({ sent: 1, gone: 1, failed: 0 });
    expect(dropped).toEqual(["https://fcm.googleapis.com/fcm/send/t1"]);
    expect(marked).toEqual(["e"]);
  });

  it("throws (so the job is retried) when every send failed, without marking it sent", async () => {
    const { store, marked } = fakeStore([target(1), target(2)]);
    const send: Sender = async () => {
      throw Object.assign(new Error("down"), { statusCode: 503 });
    };
    await expect(fanOut(store, config, "e", 3, alertFor, log, send)).rejects.toThrow(/push failed for all 2/);
    expect(marked).toEqual([]);
  });

  it("marks it sent when only some failed, so nobody gets it twice", async () => {
    const { store, marked } = fakeStore([target(1), target(2)]);
    const send: Sender = async (t) => {
      if (t.endpoint.endsWith("t1")) throw new Error("timeout");
    };
    expect(await fanOut(store, config, "e", 3, alertFor, log, send)).toEqual({ sent: 1, gone: 0, failed: 1 });
    expect(marked).toEqual(["e"]);
  });

  it("does nothing when nobody follows the zone (or it was sent already)", async () => {
    const { store, marked } = fakeStore([]);
    expect(await fanOut(store, config, "e", 3, alertFor, log, vi.fn())).toEqual({ sent: 0, gone: 0, failed: 0 });
    expect(marked).toEqual([]);
  });
});
