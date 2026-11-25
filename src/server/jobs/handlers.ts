import "server-only";
import type { Logger } from "pino";
import { getWorkerDb } from "@/src/server/db";
import { pushConfig } from "@/src/server/push/config";
import { fanOut, reportAlert, updateAlert } from "@/src/server/push/notify";
import { dbPushStore, type PushStore } from "@/src/server/push/push.repository";
import type { JobPayload } from "./jobs.schemas";
import type { Handlers } from "./worker";

// What the worker does for each job. Each handler must be safe to run twice
// (jobs.schemas.ts): the push fan-out marks each event as sent.

async function pushReport(store: PushStore, reportId: string, log: Logger) {
  const config = pushConfig();
  if (!config) return log.info("push is off on this server");
  const report = await store.report(reportId);
  if (!report) return log.info("report is not confirmed or no longer on the map: no alert");
  await fanOut(store, config, `report.confirmed:${reportId}`, report.zone_id, (lang) =>
    reportAlert(lang, { id: reportId, ...report }), log);
}

export function makeHandlers(store: () => PushStore): Handlers {
  return {
    // A new report alerts only when it is confirmed from the start (police or
    // admin); a driver's report waits for report.confirmed.
    "report.created": async (payload, { log }) =>
      pushReport(store(), (payload as JobPayload<"report.created">).report_id, log),
    "report.confirmed": async (payload, { log }) =>
      pushReport(store(), (payload as JobPayload<"report.confirmed">).report_id, log),
    "official_update.created": async (payload, { log }) => {
      const config = pushConfig();
      if (!config) return log.info("push is off on this server");
      const id = (payload as JobPayload<"official_update.created">).update_id;
      const s = store();
      const update = await s.update(id);
      if (!update) return log.info("update was deleted or has ended: no alert");
      await fanOut(s, config, `official_update.created:${id}`, update.zone_id, (lang) =>
        updateAlert(lang, { id, ...update }), log);
    },
  };
}

export const handlers: Handlers = makeHandlers(() => dbPushStore(getWorkerDb()));
