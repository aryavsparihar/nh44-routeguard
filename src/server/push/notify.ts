import "server-only";
import { createTranslator } from "next-intl";
import type { Logger } from "pino";
import { sendNotification, type PushSubscription } from "web-push";
import en from "@/messages/en.json";
import hi from "@/messages/hi.json";
import ur from "@/messages/ur.json";
import type { PushConfig } from "./config";
import type { PushStore, PushTarget } from "./push.repository";
import { isPushEndpoint } from "./push.schemas";

// Push fan-out for the queue worker (BUILD_PROMPT WP-B B6): one alert per
// event to every browser following the zone, in that browser's language.
//
//   confirmed report  → browsers following its zone
//   official update   → browsers following its zone, or all for the whole road
//
// Unconfirmed reports never alert: one person's word isn't enough to wake
// someone up. An event is pushed once (private.push_sent), even when its job
// runs twice.

const MESSAGES = { en, hi, ur } as const;
type Lang = keyof typeof MESSAGES;

export type Alert = { title: string; body: string; url: string; tag: string };

function translator(language: string) {
  const locale: Lang = language in MESSAGES ? (language as Lang) : "en";
  return createTranslator({ locale, messages: MESSAGES[locale] });
}

const HAZARDS = ["landslide", "rockfall", "flash_flood", "snow_ice", "accident", "other"] as const;
const KINDS = ["closure", "one_way", "reopened", "advisory"] as const;

export function reportAlert(language: string, r: { id: string; zone_id: number | null; hazard_type: string }): Alert {
  const t = translator(language);
  const hazard = (HAZARDS as readonly string[]).includes(r.hazard_type)
    ? t(`reports.hazard.${r.hazard_type as (typeof HAZARDS)[number]}`)
    : t("reports.hazard.other");
  return {
    title: r.zone_id === null ? t("push.report.titleRoad", { hazard }) : t("push.report.title", { hazard, zone: r.zone_id }),
    body: t("push.report.body"),
    url: "/",
    tag: `report-${r.id}`.slice(0, 64),
  };
}

export function updateAlert(
  language: string,
  u: { id: string; zone_id: number | null; kind: string; title: string; source_name: string },
): Alert {
  const t = translator(language);
  const kind = (KINDS as readonly string[]).includes(u.kind) ? t(`updates.kind.${u.kind as (typeof KINDS)[number]}`) : u.kind;
  const where = u.zone_id === null ? t("updates.wholeRoad") : t("updates.zone", { zone: u.zone_id });
  return {
    title: t("push.update.title", { kind, title: u.title }).slice(0, 120),
    body: t("push.update.body", { where, source: u.source_name }).slice(0, 300),
    url: "/status",
    tag: `update-${u.id}`.slice(0, 64),
  };
}

export type Sender = (target: PushTarget, alert: Alert, config: PushConfig) => Promise<void>;

// Alerts about the road go stale: a push service keeps one for at most 6 h.
export const sendWebPush: Sender = async (target, alert, config) => {
  if (!isPushEndpoint(target.endpoint)) throw Object.assign(new Error("not a push service"), { statusCode: 410 });
  const subscription: PushSubscription = { endpoint: target.endpoint, keys: target.keys };
  await sendNotification(subscription, JSON.stringify(alert), {
    vapidDetails: config,
    TTL: 6 * 3600,
    urgency: "high",
    timeout: 10_000,
  });
};

export type FanOutResult = { sent: number; gone: number; failed: number };

const CHUNK = 20;

// Sends to every target, 20 at a time. A browser the push service says is
// gone (404/410) is dropped. When every send failed (the push service is
// down), it throws so the job is tried again; otherwise the event is marked
// sent, and the few failures are only logged.
export async function fanOut(
  store: PushStore,
  config: PushConfig,
  eventKey: string,
  zone: number | null,
  alertFor: (language: string) => Alert,
  log: Logger,
  send: Sender = sendWebPush,
): Promise<FanOutResult> {
  const targets = await store.targets(eventKey, zone);
  const result: FanOutResult = { sent: 0, gone: 0, failed: 0 };
  const cache = new Map<string, Alert>();
  for (let i = 0; i < targets.length; i += CHUNK) {
    const chunk = targets.slice(i, i + CHUNK);
    const outcomes = await Promise.allSettled(
      chunk.map((target) => {
        let alert = cache.get(target.language);
        if (!alert) cache.set(target.language, (alert = alertFor(target.language)));
        return send(target, alert, config);
      }),
    );
    for (const [k, outcome] of outcomes.entries()) {
      if (outcome.status === "fulfilled") {
        result.sent++;
        continue;
      }
      const status = (outcome.reason as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        result.gone++;
        await store.drop(chunk[k].endpoint);
      } else {
        result.failed++;
      }
    }
  }
  if (result.failed > 0 && result.sent === 0 && result.gone < targets.length) {
    throw new Error(`push failed for all ${result.failed} browsers`);
  }
  if (targets.length > 0) await store.markSent(eventKey);
  log.info({ event: eventKey.split(":")[0], ...result }, "push fan-out");
  return result;
}
