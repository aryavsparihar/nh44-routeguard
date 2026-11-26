// The screens each kind of user has, so every one of them is a tap away on a
// phone (the installed app has no address bar). The pages and the API check
// the role again; this only decides which links to show.
import type { MeProfile } from "@/src/shared/api-types";

export type ScreenKey =
  | "tcu"
  | "approvals"
  | "updates"
  | "adminReports"
  | "roadStatus"
  | "audit"
  | "board"
  | "report"
  | "advisor"
  | "strip"
  | "map";

// signIn: a page behind sign-in, opened with a full page load (SignInLink).
export type Screen = { key: ScreenKey; href: string; signIn: boolean };

const S: Record<ScreenKey, Screen> = {
  tcu: { key: "tcu", href: "/admin", signIn: true },
  approvals: { key: "approvals", href: "/admin/approvals", signIn: true },
  updates: { key: "updates", href: "/admin/updates", signIn: true },
  adminReports: { key: "adminReports", href: "/admin/reports", signIn: true },
  roadStatus: { key: "roadStatus", href: "/admin/road-status", signIn: true },
  audit: { key: "audit", href: "/admin/audit", signIn: true },
  board: { key: "board", href: "/board", signIn: true },
  report: { key: "report", href: "/report/new", signIn: true },
  advisor: { key: "advisor", href: "/advisor", signIn: false },
  strip: { key: "strip", href: "/strip", signIn: false },
  map: { key: "map", href: "/", signIn: false },
};

// Until TCU approves an account it has no role anywhere, so it gets only the
// public screens.
export function screensFor(me: Pick<MeProfile, "role" | "approval">): Screen[] {
  if (me.approval !== "approved" || !me.role) return [S.map, S.advisor];
  switch (me.role) {
    case "admin":
      return [S.tcu, S.approvals, S.updates, S.adminReports, S.roadStatus, S.audit, S.board, S.report];
    case "agent":
      return [S.board, S.report, S.advisor, S.map];
    case "driver":
      return [S.board, S.report, S.map, S.strip];
    case "grower":
    case "trader":
      return [S.advisor, S.board, S.strip, S.map];
    default:
      // Old police accounts have no role since the TCU merge.
      return [S.map, S.advisor];
  }
}
