import rawObservations from "../../../data/observations.json";
import { indicators } from "./indicators";
import { officialSources } from "./sources";
import { observationDatasetSchema } from "./validation";
import { getComparableSeriesKey, latestApprovedRevisions } from "./series";
import type { IndicatorId, Observation, ObservationFilters, OfficialSource } from "./types";

export * from "./types";
export { indicators, officialSources };
export { getComparableSeriesKey, latestApprovedRevisions } from "./series";

/** No synthetic financial values are used to fill a missing official dataset. */
export const observations: Observation[] = observationDatasetSchema.parse(rawObservations);

export function getSourceById(id: string) {
  return officialSources.find((source) => source.id === id) ?? null;
}

export function getIndicatorById(id: string) {
  return indicators.find((indicator) => indicator.id === id) ?? null;
}

export function getObservations(filters: ObservationFilters = {}): Observation[] {
  return observations.filter((observation) => {
    const year = Number(observation.referenceDate.slice(0, 4));
    return (
      (!filters.indicatorId || observation.indicatorId === filters.indicatorId) &&
      (!filters.scope || observation.scope === filters.scope) &&
      (filters.fromYear === undefined || year >= filters.fromYear) &&
      (filters.toYear === undefined || year <= filters.toYear)
    );
  }).sort((a, b) => a.referenceDate.localeCompare(b.referenceDate) || a.version - b.version);
}

export function buildDashboardData(items: Observation[], sources: OfficialSource[] = officialSources) {
  const current = latestApprovedRevisions(items);
  const byIndicator: Partial<Record<IndicatorId, Observation>> = {};
  for (const observation of current) byIndicator[observation.indicatorId] = observation;
  const comparabilityWarnings: Partial<Record<IndicatorId, {
    code: "multiple_definitions";
    seriesKeys: string[];
    selectedObservationId: string;
  }>> = {};
  for (const [id, selected] of Object.entries(byIndicator) as [IndicatorId, Observation][]) {
    const seriesKeys = [...new Set(current.filter((item) => item.indicatorId === id && item.referenceDate === selected.referenceDate)
      .map(getComparableSeriesKey))];
    if (seriesKeys.length > 1) comparabilityWarnings[id] = {
      code: "multiple_definitions", seriesKeys, selectedObservationId: selected.id,
    };
  }
  return {
    observations: current,
    sources,
    years: [...new Set(current.map((observation) => Number(observation.referenceDate.slice(0, 4))))].sort((a, b) => b - a),
    latestDebt: byIndicator.debt_treasury ?? null,
    byIndicator,
    comparabilityWarnings,
  };
}

export function getDashboardData() {
  return buildDashboardData(getObservations());
}

export type DashboardData = ReturnType<typeof getDashboardData> & {
  integrationStatus?: "snapshot" | "connected" | "unavailable";
  integrationNote?: string;
};
