import { describe, expect, it, vi } from "vitest";
import { jobAfterConfirm, jobAfterSubmit } from "./reports.repository";

vi.mock("server-only", () => ({}));

describe("which queue job a report write adds", () => {
  it("adds report.created for every new report", () => {
    expect(jobAfterSubmit({ outcome: "created", status: "unconfirmed" })).toBe("report.created");
    expect(jobAfterSubmit({ outcome: "created", status: "confirmed" })).toBe("report.created");
  });

  it("adds report.confirmed when a merge leaves the report confirmed", () => {
    expect(jobAfterSubmit({ outcome: "merged", status: "confirmed" })).toBe("report.confirmed");
    expect(jobAfterSubmit({ outcome: "merged", status: "unconfirmed" })).toBeNull();
  });

  it("adds nothing for a repeat of the same report", () => {
    expect(jobAfterSubmit({ outcome: "repeat", status: "confirmed" })).toBeNull();
  });

  it("adds report.confirmed for a new confirmation of a confirmed report only", () => {
    expect(jobAfterConfirm({ outcome: "confirmed", status: "confirmed" })).toBe(true);
    expect(jobAfterConfirm({ outcome: "confirmed", status: "unconfirmed" })).toBe(false);
    expect(jobAfterConfirm({ outcome: "repeat", status: "confirmed" })).toBe(false);
  });
});
