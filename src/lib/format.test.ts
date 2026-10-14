import { describe, it, expect } from "vitest";
import { csvEscape, formatDecimal, formatObservation, observationsCsv } from "./format";
import { hrefFor, resolveRoute } from "./i18n";
import type { Observation } from "./data/types";
const sample:Observation={id:"test",indicatorId:"debt_treasury",value:1000,exactValue:"1000.125",unit:"MAD",scale:1000000,scope:"treasury",period:"2024",referenceDate:"2024-12-31",publicationDate:"2025-03-01",sourceId:"mef",sourceUrl:"https://www.finances.gov.ma/example.pdf",documentTitle:"=malicious",documentPage:7,documentLocator:"Table A",status:"observed",validationStatus:"approved",version:1};
describe("display and exact exports",()=>{
  it("keeps all digits above JS safe integer range in a full counter",()=>{expect(formatDecimal("9007199254740993","en",0)).toBe("9,007,199,254,740,993");expect(formatDecimal("9007199254740993.125","en",3)).toBe("9,007,199,254,740,993.125");});
  it("preserves negative small amounts and leading fractional zeros",()=>{expect(formatDecimal("-0.025","en",3)).toBe("-0.025");expect(formatDecimal("1.005","en",3)).toBe("1.005");});
  it("converts the stored scale only at presentation",()=>{expect(formatObservation(sample,"en")).toBe("1 bn MAD");});
  it("exports the original exact value, scale and provenance",()=>{const csv=observationsCsv([sample]);expect(csv).toContain('"1000.125"');expect(csv).toContain('"1000000"');expect(csv).toContain(sample.sourceUrl);});
  it("neutralises spreadsheet formula injection without changing negative numbers",()=>{expect(csvEscape("=SUM(A1)")).toBe('"\'=SUM(A1)"');expect(csvEscape("-123.5")).toBe('"-123.5"');expect(csvEscape("-cmd")).toBe('"\'-cmd"');});
  it("quotes commas and quotes",()=>{expect(csvEscape('a,"b"')).toBe('"a,""b"""');});
});
describe("locale routing",()=>{
  it("resolves Arabic routes without changing the indicator path",()=>{expect(resolveRoute(["ar","budget"])).toEqual({locale:"ar",slug:"budget",valid:true});expect(hrefFor("ar","budget")).toBe("/ar/budget");});
  it("rejects nested unknown pages",()=>{expect(resolveRoute(["budget","unknown"]).valid).toBe(false);});
  it("keeps French public paths at the root",()=>{expect(hrefFor("fr","dette-publique")).toBe("/dette-publique");});
});
