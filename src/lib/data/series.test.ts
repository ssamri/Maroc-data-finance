import { describe, expect, it } from "vitest";
import { buildDashboardData, getComparableSeriesKey, latestApprovedRevisions } from "./index";
import { observationDatasetSchema } from "./validation";
import type { Observation } from "./types";

const first: Observation = {
  id: "test-v1", indicatorId: "debt_treasury", value: 100, exactValue: "100", unit: "MAD", scale: 1,
  scope: "treasury", period: "2024", referenceDate: "2024-12-31", publicationDate: "2025-02-01",
  sourceId: "mef", sourceUrl: "https://www.finances.gov.ma/synthetic-test-only.pdf",
  documentTitle: "Synthetic test document", documentPage: null, documentLocator: "Test row",
  status: "observed", validationStatus: "approved", version: 1,
  provenance: {
    documentId: "test-document", documentSha256: null, retrievedAt: "2025-02-02T12:00:00Z",
    indicatorDefinitionId: "test-definition", definitionVersion: 1, accountingBasis: "Synthetic nominal stock",
    frequency: "annual", periodStart: "2024-01-01", periodEnd: "2024-12-31",
  },
};
const revised: Observation = { ...first, id: "test-v2", value: 110, exactValue: "110", version: 2, publicationDate: "2025-03-01" };

describe("approved revision and comparison boundaries", () => {
  it("keeps the latest revision without deleting the original audit input", () => {
    const history = [revised, first];
    expect(latestApprovedRevisions(history)).toEqual([revised]);
    expect(history).toEqual([revised, first]);
    expect(buildDashboardData(history).byIndicator.debt_treasury).toEqual(revised);
  });

  it("accepts separate approved definitions for the same indicator and reference date", () => {
    const alternative: Observation = {
      ...first, id: "test-other-definition",
      provenance: { ...first.provenance!, indicatorDefinitionId: "alternative-definition", definitionVersion: 2 },
    };
    expect(observationDatasetSchema.safeParse([first, alternative]).success).toBe(true);
    expect(latestApprovedRevisions([first, alternative])).toHaveLength(2);
    expect(getComparableSeriesKey(first)).not.toBe(getComparableSeriesKey(alternative));
    expect(buildDashboardData([first, alternative]).comparabilityWarnings.debt_treasury?.code).toBe("multiple_definitions");
  });

  it("does not splice different accounting bases or frequencies into one series", () => {
    for (const metadata of [{ accountingBasis: "Different consolidated basis" }, { frequency: "point_in_time" as const }, { definitionVersion: 2 }]) {
      const other = { ...first, provenance: { ...first.provenance!, ...metadata } };
      expect(getComparableSeriesKey(other)).not.toBe(getComparableSeriesKey(first));
    }
    expect(getComparableSeriesKey({ ...first, provenance: undefined })).not.toBe(getComparableSeriesKey(first));
  });

  it("selects the latest publication deterministically and marks incompatible selections", () => {
    const newer: Observation = {
      ...first, id: "new-definition", publicationDate: "2025-04-01",
      provenance: { ...first.provenance!, indicatorDefinitionId: "new-definition-id", definitionVersion: 2 },
    };
    for (const history of [[newer, revised, first], [first, revised, newer]]) {
      const data = buildDashboardData(history);
      expect(data.latestDebt?.id).toBe(newer.id);
      expect(data.comparabilityWarnings.debt_treasury?.selectedObservationId).toBe(newer.id);
      expect(data.observations).toHaveLength(2);
    }
  });

  it("retains different periods within the same definition and rejects duplicate revision keys", () => {
    const prior: Observation = {
      ...first, id: "prior", period: "2023", referenceDate: "2023-12-31",
      provenance: { ...first.provenance!, periodStart: "2023-01-01", periodEnd: "2023-12-31" },
    };
    expect(latestApprovedRevisions([first, prior, revised])).toEqual([prior, revised]);
    expect(observationDatasetSchema.safeParse([first, { ...first, id: "same-revision" }]).success).toBe(false);
  });
});
