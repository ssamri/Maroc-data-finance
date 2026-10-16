import type { Observation } from "./types";

/** A shared indicator name is insufficient to harmonize accounting definitions.
 * Keep document producer, unit/scale, definition version, basis and frequency in
 * the series key. Missing snapshot provenance is distinct from a documented DB
 * definition; it is never silently spliced into that definition's time series.
 */
export function getComparableSeriesKey(item: Observation): string {
  return JSON.stringify([
    item.indicatorId, item.scope, item.unit, item.scale, item.sourceId,
    item.provenance?.indicatorDefinitionId ?? null,
    item.provenance?.definitionVersion ?? null,
    item.provenance?.accountingBasis ?? null,
    item.provenance?.frequency ?? null,
  ]);
}

export function getObservationPeriodKey(item: Observation): string {
  return JSON.stringify([
    getComparableSeriesKey(item),
    item.provenance?.periodStart ?? item.period,
    item.provenance?.periodEnd ?? item.referenceDate,
  ]);
}

/** This produces a display view; the caller's original revision records remain
 * untouched for audit/history. Observation versions only replace one another
 * within the same documented comparable series and reference period.
 */
export function latestApprovedRevisions(items: readonly Observation[]): Observation[] {
  const latest = new Map<string, Observation>();
  for (const item of items) {
    if (item.validationStatus !== "approved" || !["observed", "provisional"].includes(item.status)) continue;
    const key = getObservationPeriodKey(item);
    const previous = latest.get(key);
    if (!previous || item.version > previous.version || (
      item.version === previous.version && (
        item.publicationDate > previous.publicationDate ||
        (item.publicationDate === previous.publicationDate && item.id > previous.id)
      )
    )) latest.set(key, item);
  }
  return [...latest.values()].sort(compareObservationRecency);
}

/** Deterministic latest selection when multiple definitions have the same date.
 * A separate comparability warning must accompany such a selection.
 */
export function compareObservationRecency(a: Observation, b: Observation): number {
  return a.referenceDate.localeCompare(b.referenceDate) ||
    a.publicationDate.localeCompare(b.publicationDate) ||
    (a.provenance?.definitionVersion ?? 0) - (b.provenance?.definitionVersion ?? 0) ||
    a.version - b.version || a.id.localeCompare(b.id);
}
