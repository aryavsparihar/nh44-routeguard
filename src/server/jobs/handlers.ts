import "server-only";
import type { Handlers } from "./worker";

// What the worker does for each job. Each handler must be safe to run twice
// (jobs.schemas.ts). Push fan-out to people who follow the report's or the
// update's zone is added with Web Push (BUILD_PROMPT WP-B B6); until then the
// worker only records that the event happened, in its log.
export const handlers: Handlers = {
  "report.created": async (_payload, { log }) => {
    log.info("report created");
  },
  "report.confirmed": async (_payload, { log }) => {
    log.info("report confirmed");
  },
  "official_update.created": async (_payload, { log }) => {
    log.info("official update created");
  },
};
