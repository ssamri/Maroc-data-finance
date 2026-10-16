import { calculatedDecimal, decimal, FinancialDecimal, requireNonNegative, requirePositive, requireText } from "./decimal";
import { daysInYear, MILLISECONDS_PER_DAY, secondsInYear, utcDate } from "./dates";
import type { CalculatedValue, DebtStockProjection, FinancialObservation, Scale, UtcDateInput } from "./types";

const SCALE_FACTORS: Record<Scale, string> = {
  unit: "1",
  thousand: "1000",
  million: "1000000",
  billion: "1000000000",
};
export const MAX_PROJECTION_DAYS = 366;

export function convertScale(value: string, from: Scale, to: Scale): string {
  if (!Object.prototype.hasOwnProperty.call(SCALE_FACTORS, from) || !Object.prototype.hasOwnProperty.call(SCALE_FACTORS, to)) {
    throw new TypeError("Unknown scale");
  }
  return decimal(value).mul(SCALE_FACTORS[from]).div(SCALE_FACTORS[to]).toFixed();
}

function validateObservation(observation: FinancialObservation): void {
  requireText(observation.indicatorId, "indicatorId");
  requireText(observation.scope, "scope");
  decimal(observation.value);
  if (!Object.prototype.hasOwnProperty.call(SCALE_FACTORS, observation.scale)) {
    throw new TypeError("Unknown observation scale");
  }
  if (!["MAD", "person", "percent", "ratio"].includes(observation.unit)) {
    throw new TypeError("Unknown observation unit");
  }
  if (observation.status !== "official" && observation.status !== "provisional") {
    throw new TypeError("Historical inputs must be official or provisional observations");
  }
  utcDate(observation.referenceDate, "referenceDate");
}

/** A fixed observation is returned unchanged in value and economic metadata. */
export function fixedObservation(observation: FinancialObservation): FinancialObservation {
  validateObservation(observation);
  return { ...observation };
}

export function interpolateObservations(
  start: FinancialObservation,
  end: FinancialObservation,
  at: UtcDateInput,
): CalculatedValue {
  validateObservation(start);
  validateObservation(end);
  for (const key of ["indicatorId", "unit", "scale", "scope"] as const) {
    if (start[key] !== end[key]) throw new RangeError(`Observations have different ${key}`);
  }
  if(!start.comparability || !end.comparability) throw new RangeError("Comparable definition metadata required");
  for(const key of ["definitionId","definitionVersion","accountingBasis","frequency"] as const) {
    if(start.comparability[key]!==end.comparability[key]) throw new RangeError(`Observations have different ${key}`);
  }
  requireText(start.comparability.definitionId,"definitionId");
  requireText(start.comparability.accountingBasis,"accountingBasis");
  if(!Number.isInteger(start.comparability.definitionVersion) || start.comparability.definitionVersion<1 || !["annual","quarterly","monthly","point_in_time"].includes(start.comparability.frequency)) throw new RangeError("Invalid comparable definition metadata");
  const startDate = utcDate(start.referenceDate);
  const endDate = utcDate(end.referenceDate);
  const target = utcDate(at, "at");
  const duration = endDate.getTime() - startDate.getTime();
  if (duration <= 0) throw new RangeError("Interpolation requires strictly ordered observation dates");
  const elapsed = target.getTime() - startDate.getTime();
  if (elapsed < 0 || elapsed > duration) throw new RangeError("Interpolation date lies outside the observation interval");
  const value = decimal(start.value).add(
    decimal(end.value).sub(decimal(start.value)).mul(String(elapsed)).div(String(duration)),
  );
  return {
    value: elapsed === 0 ? start.value : elapsed === duration ? end.value : calculatedDecimal(value),
    unit: start.unit,
    scale: start.scale,
    scope: start.scope,
    at: target.toISOString(),
    status: "estimated",
    method: `Interpolation linéaire entre les observations du ${start.referenceDate} et du ${end.referenceDate}; aucune mesure officielle en direct.`,
  };
}

/** A bounded linear projection from an explicit, documented annual STOCK variation. */
export function projectDebtStock(spec: DebtStockProjection, at: UtcDateInput): CalculatedValue {
  validateObservation(spec.anchor);
  if (spec.anchor.unit !== "MAD") throw new RangeError("Debt stock projection requires MAD");
  requireNonNegative(decimal(spec.anchor.value), "anchor debt stock");
  requireText(spec.method, "method");
  const annualChange = decimal(spec.annualStockChange, "annualStockChange");
  const anchorDate = utcDate(spec.anchor.referenceDate);
  const horizon = utcDate(spec.validUntil, "validUntil");
  const target = utcDate(at, "at");
  const horizonDuration = horizon.getTime() - anchorDate.getTime();
  if (horizonDuration <= 0 || horizonDuration > MAX_PROJECTION_DAYS * MILLISECONDS_PER_DAY) {
    throw new RangeError(`Projection horizon must be positive and at most ${MAX_PROJECTION_DAYS} days`);
  }
  if (target < anchorDate || target > horizon) {
    throw new RangeError("Projection date lies outside its explicit validity interval");
  }
  const elapsedMilliseconds = String(target.getTime() - anchorDate.getTime());
  const value = decimal(spec.anchor.value).add(
    annualChange.mul(elapsedMilliseconds).div(new FinancialDecimal(secondsInYear(spec.rateReferenceYear)).mul("1000")),
  );
  requireNonNegative(value, "projected debt stock");
  return {
    value: calculatedDecimal(value),
    unit: spec.anchor.unit,
    scale: spec.anchor.scale,
    scope: spec.anchor.scope,
    at: target.toISOString(),
    status: "projection",
    method: spec.method,
  };
}

export function annualFlowPerSecond(value: string, referenceYear: number): string {
  return calculatedDecimal(decimal(value).div(String(secondsInYear(referenceYear))));
}

export function annualFlowPerDay(value: string, referenceYear: number): string {
  return calculatedDecimal(decimal(value).div(String(daysInYear(referenceYear))));
}

/** Both amount arguments are expressed in base MAD. */
export function debtToGdpPercent(debtMad: string, gdpMad: string): string {
  const debt = requireNonNegative(decimal(debtMad, "debtMad"), "debtMad");
  const gdp = requirePositive(decimal(gdpMad, "gdpMad"), "gdpMad");
  return calculatedDecimal(debt.div(gdp).mul("100"));
}

/** Debt is base MAD, population is persons. */
export function debtPerCapita(debtMad: string, population: string): string {
  const debt = requireNonNegative(decimal(debtMad, "debtMad"), "debtMad");
  const persons = requirePositive(decimal(population, "population"), "population");
  return calculatedDecimal(debt.div(persons));
}
