import Decimal from "decimal.js";

/** A private constructor avoids changes to the global decimal.js configuration. */
export const FinancialDecimal = Decimal.clone({
  precision: 80,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -100,
  toExpPos: 100,
});

export function decimal(value: string, name = "value"): Decimal {
  if (typeof value !== "string" || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    throw new TypeError(`${name} must be a finite decimal string without exponent notation`);
  }
  // More than 60 significant digits cannot describe a supported financial value.
  // This also bounds parsing cost and retains headroom for 80-digit arithmetic.
  const significant = value.replace(/^-/, "").replace(".", "").replace(/^0+/, "");
  if (significant.length > 60) {
    throw new RangeError(`${name} exceeds the supported precision of 60 digits`);
  }
  const result = new FinancialDecimal(value);
  if (!result.isFinite()) throw new RangeError(`${name} must be finite`);
  return result;
}

export function requireNonNegative(value: Decimal, name: string): Decimal {
  if (value.lt("0")) throw new RangeError(`${name} must be non-negative`);
  return value;
}

export function requirePositive(value: Decimal, name: string): Decimal {
  if (!value.gt("0")) throw new RangeError(`${name} must be greater than zero`);
  return value;
}

/** Division-derived values are rounded only at the public boundary, to 18 decimals. */
export function calculatedDecimal(value: Decimal): string {
  if (!value.isFinite()) throw new RangeError("Calculated value is not finite");
  return value.toDecimalPlaces(18, Decimal.ROUND_HALF_UP).toFixed();
}

export function requireText(value: string, name: string): void {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${name} must be explicit and non-empty`);
  }
}
