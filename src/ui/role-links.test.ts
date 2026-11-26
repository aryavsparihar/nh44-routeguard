import { describe, expect, it } from "vitest";
import { PROTECTED_PAGES } from "@/src/server/auth/protected-pages";
import { readTcuHint, saveTcuHint } from "./role-hint";
import { screensFor } from "./role-links";

const hrefs = (role: Parameters<typeof screensFor>[0]["role"], approval: Parameters<typeof screensFor>[0]["approval"] = "approved") =>
  screensFor({ role, approval }).map((s) => s.href);

describe("screensFor", () => {
  it("gives TCU every console screen, starting with the console itself", () => {
    expect(hrefs("admin")).toEqual([
      "/admin",
      "/admin/approvals",
      "/admin/updates",
      "/admin/reports",
      "/admin/road-status",
      "/admin/audit",
      "/board",
      "/report/new",
    ]);
  });

  it("gives agents and drivers the board and the report screen", () => {
    for (const role of ["agent", "driver"] as const) {
      expect(hrefs(role)).toContain("/board");
      expect(hrefs(role)).toContain("/report/new");
      expect(hrefs(role).some((h) => h.startsWith("/admin"))).toBe(false);
    }
  });

  it("gives growers and traders the advisor and the board, but no report screen", () => {
    for (const role of ["grower", "trader"] as const) {
      expect(hrefs(role).slice(0, 2)).toEqual(["/advisor", "/board"]);
      expect(hrefs(role)).not.toContain("/report/new");
    }
  });

  it("gives an account waiting for TCU, or an old police account, only public screens", () => {
    expect(hrefs("driver", "pending")).toEqual(["/", "/advisor"]);
    expect(hrefs("agent", "rejected")).toEqual(["/", "/advisor"]);
    expect(hrefs(null, null)).toEqual(["/", "/advisor"]);
    expect(hrefs("police")).toEqual(["/", "/advisor"]);
  });

  it("marks every page behind sign-in as a full page load", () => {
    for (const role of ["admin", "agent", "driver", "grower", "trader"] as const) {
      for (const s of screensFor({ role, approval: "approved" })) {
        const isProtected = PROTECTED_PAGES.some((p) => s.href === p || s.href.startsWith(`${p}/`));
        expect(s.signIn, s.href).toBe(isProtected);
      }
    }
  });
});

describe("TCU hint", () => {
  it("is saved for TCU and removed for anyone else", () => {
    const data = new Map<string, string>();
    const s = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
    expect(readTcuHint(s)).toBe(false);
    saveTcuHint(true, s);
    expect(readTcuHint(s)).toBe(true);
    saveTcuHint(false, s);
    expect(readTcuHint(s)).toBe(false);
    expect(readTcuHint(null)).toBe(false);
  });
});
