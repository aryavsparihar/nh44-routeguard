import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VERIFIED_LEVELS, isVerifiedLevel } from "./verification";

describe("isVerifiedLevel", () => {
  it("counts a vouch, the Aadhaar check and official accounts, nothing else", () => {
    expect(["agent_vouched", "aadhaar_qr", "official"].map(isVerifiedLevel)).toEqual([true, true, true]);
    expect(["none", "email", "", null, undefined, "Official"].map(isVerifiedLevel)).toEqual([false, false, false, false, false, false]);
  });

  it("matches private.is_verified() in the database", () => {
    const sql = readFileSync("supabase/migrations/20261125160000_reports_write.sql", "utf8");
    const body = sql.slice(sql.indexOf("function private.is_verified("));
    const list = body.match(/in \(([^)]*)\)/)![1];
    expect(list.match(/'([a-z_]+)'/g)!.map((s) => s.slice(1, -1))).toEqual([...VERIFIED_LEVELS]);
  });
});
