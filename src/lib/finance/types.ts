/** Exact decimal input/output. Never convert financial calculations to JS numbers. */
export type DecimalString = string;

export type Scale = "unit" | "thousand" | "million" | "billion";
export type Unit = "MAD" | "person" | "percent" | "ratio";
export type UtcDateInput = string | Date;

export interface FinancialObservation {
  indicatorId: string;
  value: DecimalString;
  unit: Unit;
  scale: Scale;
  scope: string;
  referenceDate: string;
  status: "official" | "provisional";
  sourceUrl?: string;
  /** Mandatory for interpolation; absent metadata cannot establish comparability. */
  comparability?: {
    definitionId: string;
    definitionVersion: number;
    accountingBasis: string;
    frequency: "annual" | "quarterly" | "monthly" | "point_in_time";
  };
}

export interface CalculatedValue {
  value: DecimalString;
  unit: Unit;
  scale: Scale;
  scope: string;
  at: string;
  status: "estimated" | "projection";
  method: string;
}

export interface DebtStockProjection {
  anchor: FinancialObservation;
  /** Annual variation of the debt STOCK, in the anchor's unit and scale. */
  annualStockChange: DecimalString;
  /** Defines the 365/366-day denominator of the documented annual variation. */
  rateReferenceYear: number;
  /** Required, inclusive horizon; cannot exceed 366 days after the anchor. */
  validUntil: string;
  method: string;
}

export interface DebtScenarioInput {
  initialDebtMad: DecimalString;
  initialGdpMad: DecimalString;
  population: DecimalString;
  startYear: number;
  /** Between 1 and 30 inclusive. Population stays constant in this scenario. */
  years: number;
  /** Net stock variation; incorporates principal repayments already. */
  annualNetDebtStockChangeMad: DecimalString;
  annualGdpGrowthPercent: DecimalString;
  annualInterestRatePercent: DecimalString;
  annualPrincipalRepaymentMad: DecimalString;
  /** Required explicit assumptions, to label the result as a simulation. */
  assumptions: string;
}

export interface ScenarioYear {
  year: number;
  openingDebtMad: DecimalString;
  debtMad: DecimalString;
  gdpMad: DecimalString;
  population: DecimalString;
  interestMad: DecimalString;
  principalMad: DecimalString;
  debtServiceMad: DecimalString;
  debtToGdpPercent: DecimalString;
  debtPerCapitaMad: DecimalString;
  status: "simulation";
  assumptions: string;
}
