import { calculatedDecimal, decimal, requireNonNegative, requirePositive, requireText } from "./decimal";
import { daysInYear } from "./dates";
import type { DebtScenarioInput, ScenarioYear } from "./types";

export const MAX_SCENARIO_YEARS = 30;

/**
 * Explicit simulation, never an official forecast. Interest is an annual cost
 * on opening debt. Net debt stock change already includes all financing flows;
 * scheduled principal is disclosed in debt service without a second subtraction.
 */
export function simulateDebtScenario(spec: DebtScenarioInput): ScenarioYear[] {
  requireText(spec.assumptions, "assumptions");
  daysInYear(spec.startYear);
  if (!Number.isInteger(spec.years) || spec.years < 1 || spec.years > MAX_SCENARIO_YEARS) {
    throw new RangeError(`years must be an integer between 1 and ${MAX_SCENARIO_YEARS}`);
  }
  if (spec.startYear + spec.years > 9999) throw new RangeError("Scenario exceeds the supported calendar");
  let debt = requireNonNegative(decimal(spec.initialDebtMad, "initialDebtMad"), "initialDebtMad");
  let gdp = requirePositive(decimal(spec.initialGdpMad, "initialGdpMad"), "initialGdpMad");
  const population = requirePositive(decimal(spec.population, "population"), "population");
  const stockChange = decimal(spec.annualNetDebtStockChangeMad, "annualNetDebtStockChangeMad");
  const growth = decimal(spec.annualGdpGrowthPercent, "annualGdpGrowthPercent");
  const interestRate = requireNonNegative(decimal(spec.annualInterestRatePercent, "annualInterestRatePercent"), "annualInterestRatePercent");
  const principal = requireNonNegative(decimal(spec.annualPrincipalRepaymentMad, "annualPrincipalRepaymentMad"), "annualPrincipalRepaymentMad");
  if (growth.lte("-100") || growth.gt("100")) throw new RangeError("GDP growth must be greater than -100% and at most 100%");
  if (interestRate.gt("100")) throw new RangeError("Interest rate cannot exceed 100%");
  const growthFactor = growth.div("100").add("1");
  const results: ScenarioYear[] = [];
  for (let offset = 0; offset < spec.years; offset += 1) {
    const openingDebt = debt;
    if (principal.gt(openingDebt)) throw new RangeError("Principal repayment exceeds opening debt");
    const interest = openingDebt.mul(interestRate).div("100");
    debt = requireNonNegative(openingDebt.add(stockChange), "scenario debt stock");
    gdp = requirePositive(gdp.mul(growthFactor), "scenario GDP");
    results.push({
      year: spec.startYear + offset + 1,
      openingDebtMad: calculatedDecimal(openingDebt),
      debtMad: calculatedDecimal(debt),
      gdpMad: calculatedDecimal(gdp),
      population: population.toFixed(),
      interestMad: calculatedDecimal(interest),
      principalMad: principal.toFixed(),
      debtServiceMad: calculatedDecimal(interest.add(principal)),
      debtToGdpPercent: calculatedDecimal(debt.div(gdp).mul("100")),
      debtPerCapitaMad: calculatedDecimal(debt.div(population)),
      status: "simulation",
      assumptions: spec.assumptions,
    });
  }
  return results;
}
