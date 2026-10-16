import { describe, expect, it } from "vitest";
import { getDashboardData, observations } from "./index";
import { observationDatasetSchema, observationSchema } from "./validation";

// Synthetic data is used only in tests and is never included in the public dataset.
const fixture = {
  id: "synthetic_test_only", indicatorId: "debt_treasury", value: 1234.5, exactValue: "1234.50",
  unit: "MAD", scale: 1000000, scope: "treasury", period: "2024",
  referenceDate: "2024-12-31", publicationDate: "2025-06-01", sourceId: "mef",
  sourceUrl: "https://www.finances.gov.ma/synthetic-test-only.pdf", documentTitle: "Synthetic test document",
  documentPage: 1, documentLocator: "Test table", status: "observed", validationStatus: "approved", version: 1,
};

describe("official observation boundary", () => {
  it("keeps unavailable data empty and never falls back to synthetic debt", () => {
    expect(observations).toEqual([]);
    expect(getDashboardData().latestDebt).toBeNull();
    expect(getDashboardData().years).toEqual([]);
  });
  it("preserves the exact published decimal", () => {
    expect(observationSchema.parse(fixture).exactValue).toBe("1234.50");
    expect(observationSchema.safeParse({ ...fixture, value: 1235 }).success).toBe(false);
  });
  it("rejects estimates, unreviewed imports and mismatched economic scopes", () => {
    for (const change of [{ status: "estimated" }, { validationStatus: "pending_review" }, { scope: "general_government" }]) {
      expect(observationSchema.safeParse({ ...fixture, ...change }).success).toBe(false);
    }
  });
  it("requires a real calendar date and a producer domain", () => {
    expect(observationSchema.safeParse({ ...fixture, referenceDate: "2024-02-30" }).success).toBe(false);
    expect(observationSchema.safeParse({ ...fixture, sourceUrl: "https://finances.gov.ma.attacker.test/a" }).success).toBe(false);
  });
  it("rejects duplicate observations and revisions", () => {
    expect(observationDatasetSchema.safeParse([fixture, { ...fixture, id: "other" }]).success).toBe(false);
  });
});
