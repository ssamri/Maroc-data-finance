import type { UtcDateInput } from "./types";

export const MILLISECONDS_PER_DAY = 86_400_000;

/** UTC only. Date-only inputs are midnight UTC; local/ambiguous strings are rejected. */
export function utcDate(input: UtcDateInput, name = "date"): Date {
  if (input instanceof Date) {
    if (!Number.isFinite(input.getTime())) throw new RangeError(`${name} is invalid`);
    return new Date(input.getTime());
  }
  if (typeof input !== "string" ||
      !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(input)) {
    throw new TypeError(`${name} must be a YYYY-MM-DD date or an ISO UTC timestamp`);
  }
  const result = new Date(input.length === 10 ? `${input}T00:00:00.000Z` : input);
  if (!Number.isFinite(result.getTime()) || result.toISOString().slice(0, 10) !== input.slice(0, 10)) {
    throw new RangeError(`${name} is not a valid calendar date`);
  }
  // JS accepts 24:00 and normalizes it; compare time components to reject normalization.
  if (input.length > 10 && result.toISOString().slice(11, 19) !== input.slice(11, 19)) {
    throw new RangeError(`${name} is not a valid UTC time`);
  }
  return result;
}

export function daysInYear(year: number): number {
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new RangeError("year must be an integer between 1 and 9999");
  }
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;
}

export function secondsInYear(year: number): number {
  return daysInYear(year) * 86_400;
}
