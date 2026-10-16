import { describe, expect, it } from "vitest";
import {
  annualFlowPerDay,
  annualFlowPerSecond,
  convertScale,
  daysInYear,
  debtPerCapita,
  debtToGdpPercent,
  fixedObservation,
  interpolateObservations,
  projectDebtStock,
  simulateDebtScenario,
  utcDate,
} from "./index";
import type { DebtScenarioInput, DebtStockProjection, FinancialObservation, Scale } from "./types";

const observation: FinancialObservation = {
  indicatorId: "treasury_debt_stock",
  value: "1000",
  unit: "MAD",
  scale: "billion",
  scope: "treasury",
  referenceDate: "2024-01-01",
  status: "official",
  sourceUrl: "https://www.finances.gov.ma/",
  comparability: {definitionId:"treasury-stock-test",definitionVersion:1,accountingBasis:"Nominal gross outstanding Treasury stock",frequency:"annual"},
};
const projection: DebtStockProjection = {
  anchor: observation,
  annualStockChange: "100",
  rateReferenceYear: 2024,
  validUntil: "2025-01-01",
  method: "Variation annuelle documentée du stock du Trésor; hypothèse linéaire pendant 366 jours.",
};
const scenario: DebtScenarioInput = {
  initialDebtMad: "1000",
  initialGdpMad: "2000",
  population: "10",
  startYear: 2025,
  years: 2,
  annualNetDebtStockChangeMad: "100",
  annualGdpGrowthPercent: "10",
  annualInterestRatePercent: "5",
  annualPrincipalRepaymentMad: "20",
  assumptions: "Hypothèses fictives; population constante; aucun engagement public.",
};

describe("decimal quantities and scale conversion", () => {
  it("preserves monetary values beyond JavaScript's safe integer precision", () => {
    expect(convertScale("9007199254740993.25", "unit", "billion")).toBe("9007199.25474099325");
    expect(convertScale("9007199.25474099325", "billion", "unit")).toBe("9007199254740993.25");
    expect(debtPerCapita("9007199254740993", "3")).toBe("3002399751580331");
  });

  it("round-trips every supported scale without losing decimals", () => {
    const scales: Scale[] = ["unit", "thousand", "million", "billion"];
    for (const from of scales) {
      for (const to of scales) {
        const converted = convertScale("1234567890.123456789", from, to);
        expect(convertScale(converted, to, from)).toBe("1234567890.123456789");
      }
    }
  });

  it.each(["NaN", "Infinity", "-Infinity", "1e12", " 1", "", "1,2", "01"])("rejects noncanonical/nonfinite value %s", (invalid) => {
    expect(() => convertScale(invalid, "unit", "billion")).toThrow();
  });

  it("rejects numbers, oversized decimals, and inherited scale keys", () => {
    expect(() => convertScale(1 as unknown as string, "unit", "billion")).toThrow();
    expect(() => convertScale("9".repeat(61), "unit", "unit")).toThrow();
    expect(() => convertScale("1", "constructor" as Scale, "unit")).toThrow("Unknown scale");
  });
});

describe("fixed observations and interpolation", () => {
  it("rejects missing or changed accounting definitions and frequencies",()=>{
    const end={...observation,referenceDate:"2025-01-01"};
    expect(()=>interpolateObservations({...observation,comparability:undefined},end,"2024-07-02")).toThrow("metadata required");
    for(const changed of [{definitionId:"other"},{definitionVersion:2},{accountingBasis:"net stock"},{frequency:"monthly" as const}]) {
      expect(()=>interpolateObservations(observation,{...end,comparability:{...observation.comparability!,...changed}},"2024-07-02")).toThrow("different");
    }
  });
  it("keeps official fixed values, source and scope unchanged without mutating the input", () => {
    const result = fixedObservation(observation);
    expect(result).toEqual(observation);
    expect(result).not.toBe(observation);
  });

  it("calculates a midpoint across a leap year with an estimate status", () => {
    const end = { ...observation, value: "1100", referenceDate: "2025-01-01" };
    const midpoint = interpolateObservations(observation, end, "2024-07-02");
    expect(midpoint.value).toBe("1050");
    expect(midpoint.status).toBe("estimated");
    expect(midpoint.scope).toBe("treasury");
    expect(midpoint.method).toContain("aucune mesure officielle en direct");
    expect(interpolateObservations(observation, end, observation.referenceDate).value).toBe("1000");
    expect(interpolateObservations(observation, end, end.referenceDate).value).toBe("1100");
  });

  it("interpolates negative changes without assuming debt increases", () => {
    const end = { ...observation, value: "800", referenceDate: "2024-01-03" };
    expect(interpolateObservations(observation, end, "2024-01-02").value).toBe("900");
  });

  it.each(["indicatorId", "unit", "scale", "scope"] as const)("rejects incomparable %s", (field) => {
    const end = { ...observation, referenceDate: "2024-01-03" };
    const other = field === "unit" ? "person" : field === "scale" ? "million" : "different";
    expect(() => interpolateObservations(observation, { ...end, [field]: other } as FinancialObservation, "2024-01-02")).toThrow(`different ${field}`);
  });

  it("rejects equal/reversed dates and extrapolation beyond either observation", () => {
    expect(() => interpolateObservations(observation, observation, "2024-01-01")).toThrow("strictly ordered");
    const end = { ...observation, referenceDate: "2025-01-01" };
    expect(() => interpolateObservations(end, observation, "2024-07-02")).toThrow("strictly ordered");
    expect(() => interpolateObservations(observation, end, "2023-12-31")).toThrow("outside");
    expect(() => interpolateObservations(observation, end, "2025-01-02")).toThrow("outside");
  });
});

describe("UTC calendar and annual flow averages", () => {
  it("accounts for leap years including century exceptions", () => {
    expect(daysInYear(2024)).toBe(366);
    expect(daysInYear(2025)).toBe(365);
    expect(daysInYear(1900)).toBe(365);
    expect(daysInYear(2000)).toBe(366);
    expect(annualFlowPerSecond("31622400", 2024)).toBe("1");
    expect(annualFlowPerSecond("31536000", 2025)).toBe("1");
    expect(annualFlowPerDay("366", 2024)).toBe("1");
    expect(annualFlowPerDay("365", 2025)).toBe("1");
  });

  it.each(["2025-02-29", "2024-02-30", "2024-13-01", "2024-01-01T24:00:00Z", "2024-01-01T00:60:00Z", "2024-01-01T00:00:00", "01/02/2024"])("rejects invalid or ambiguous dates %s", (date) => {
    expect(() => utcDate(date)).toThrow();
  });

  it("rejects invalid Date instances and noninteger years", () => {
    expect(() => utcDate(new Date(NaN))).toThrow();
    expect(() => daysInYear(2024.5)).toThrow();
    expect(() => daysInYear(0)).toThrow();
    expect(() => daysInYear(Infinity)).toThrow();
    expect(utcDate("2024-02-29").toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });
});

describe("bounded debt stock projections", () => {
  it("uses the documented stock change and its leap-year denominator", () => {
    expect(projectDebtStock(projection, "2024-01-01").value).toBe("1000");
    expect(projectDebtStock(projection, "2024-07-02").value).toBe("1050");
    const end = projectDebtStock(projection, "2025-01-01");
    expect(end.value).toBe("1100");
    expect(end.status).toBe("projection");
    expect(end.method).toBe(projection.method);
  });

  it("updates for one second exactly in the client without needing a request", () => {
    const onePerSecond = { ...projection, annualStockChange: "31622400" };
    expect(projectDebtStock(onePerSecond, "2024-01-01T00:00:01Z").value).toBe("1001");
    expect(projectDebtStock(onePerSecond, "2024-01-01T00:00:00.500Z").value).toBe("1000.5");
  });

  it("never projects before its anchor, after expiry, or beyond its 366-day cap", () => {
    expect(() => projectDebtStock(projection, "2023-12-31")).toThrow("outside");
    expect(() => projectDebtStock(projection, "2025-01-01T00:00:00.001Z")).toThrow("outside");
    expect(() => projectDebtStock({ ...projection, validUntil: "2025-01-02" }, "2024-07-02")).toThrow("at most 366");
    expect(() => projectDebtStock({ ...projection, validUntil: "2024-01-01" }, "2024-01-01")).toThrow("positive");
  });

  it("requires explicit methods, MAD units, finite rates and nonnegative debt", () => {
    expect(() => projectDebtStock({ ...projection, method: " " }, "2024-07-02")).toThrow("method");
    expect(() => projectDebtStock({ ...projection, annualStockChange: "Infinity" }, "2024-07-02")).toThrow();
    expect(() => projectDebtStock({ ...projection, annualStockChange: "-3000" }, "2024-07-02")).toThrow("non-negative");
    expect(() => projectDebtStock({ ...projection, anchor: { ...observation, unit: "person" } }, "2024-07-02")).toThrow("MAD");
  });
});

describe("ratios and explicit scenarios", () => {
  it("computes debt/GDP and per-capita quantities in consistent base units", () => {
    expect(debtToGdpPercent("1050000000000", "1500000000000")).toBe("70");
    expect(debtPerCapita("1050000000000", "35000000")).toBe("30000");
    expect(debtPerCapita("1", "3")).toBe("0.333333333333333333");
    expect(() => debtToGdpPercent("1", "0")).toThrow("greater than zero");
    expect(() => debtPerCapita("1", "0")).toThrow("greater than zero");
    expect(() => debtPerCapita("1", "-0")).toThrow("greater than zero");
    expect(() => debtPerCapita("-1", "10")).toThrow("non-negative");
  });

  it("models net stock change, opening-debt interest, GDP growth and debt service separately", () => {
    const rows = simulateDebtScenario(scenario);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      year: 2026,
      openingDebtMad: "1000",
      debtMad: "1100",
      gdpMad: "2200",
      interestMad: "50",
      principalMad: "20",
      debtServiceMad: "70",
      debtToGdpPercent: "50",
      debtPerCapitaMad: "110",
      status: "simulation",
    });
    expect(rows[1]).toMatchObject({ year: 2027, debtMad: "1200", gdpMad: "2420", interestMad: "55" });
    expect(rows[0]?.assumptions).toBe(scenario.assumptions);
    // Do not deduct principal twice, or identify a deficit with stock change.
    expect(simulateDebtScenario({ ...scenario, annualPrincipalRepaymentMad: "0" })[0]?.debtMad).toBe("1100");
  });

  it("preserves the debt/GDP ratio when debt and GDP grow by identical factors", () => {
    const rows = simulateDebtScenario({ ...scenario, years: 1, annualNetDebtStockChangeMad: "100" });
    expect(rows[0]?.debtToGdpPercent).toBe(debtToGdpPercent(scenario.initialDebtMad, scenario.initialGdpMad));
  });

  it.each([0, -1, 31, 1.5, Infinity])("bounds simulation horizons: %s years", (years) => {
    expect(() => simulateDebtScenario({ ...scenario, years })).toThrow("years");
  });

  it("rejects impossible GDP, rates, principal, debt and absent assumptions", () => {
    expect(() => simulateDebtScenario({ ...scenario, annualGdpGrowthPercent: "-100" })).toThrow("GDP growth");
    expect(() => simulateDebtScenario({ ...scenario, annualInterestRatePercent: "-1" })).toThrow("non-negative");
    expect(() => simulateDebtScenario({ ...scenario, annualInterestRatePercent: "101" })).toThrow("100%");
    expect(() => simulateDebtScenario({ ...scenario, annualPrincipalRepaymentMad: "1001" })).toThrow("exceeds opening debt");
    expect(() => simulateDebtScenario({ ...scenario, annualNetDebtStockChangeMad: "-1001" })).toThrow("non-negative");
    expect(() => simulateDebtScenario({ ...scenario, assumptions: "" })).toThrow("assumptions");
  });
});
