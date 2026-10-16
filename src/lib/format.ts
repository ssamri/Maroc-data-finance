import { FinancialDecimal as Decimal } from "./finance/decimal";
import { intlLocale, t, type Locale } from "./i18n";
import type { Observation } from "./data/types";

/** Full counters retain integer precision; BigInt applies locale grouping exactly. */
export function formatDecimal(value: string, locale: Locale, maximumFractionDigits = 1) {
  const number = new Decimal(value);
  if(!number.isFinite() || !Number.isInteger(maximumFractionDigits) || maximumFractionDigits<0 || maximumFractionDigits>20) throw new Error("Invalid display value");
  const [integer="0",fraction=""]=number.toDecimalPlaces(maximumFractionDigits).toFixed(maximumFractionDigits).split(".");
  const fractional=fraction.replace(/0+$/,"");
  const language=intlLocale(locale);
  const grouped=new Intl.NumberFormat(language,{maximumFractionDigits:0}).format(integer==="-0"?-0:BigInt(integer));
  if(!fractional)return grouped;
  const decimal=new Intl.NumberFormat(language).formatToParts(1.1).find(part=>part.type==="decimal")?.value??".";
  const digits=new Intl.NumberFormat(language,{useGrouping:false});
  return grouped+decimal+fractional.split("").map(digit=>digits.format(Number(digit))).join("");
}
export function formatObservation(observation: Observation, locale: Locale) {
  const raw = new Decimal(observation.exactValue).mul(observation.scale);
  const d = t(locale);
  if (observation.unit === "percent") return `${formatDecimal(raw.toString(),locale)} %`;
  if (observation.unit === "persons") return formatDecimal(raw.toString(),locale,0);
  if (raw.abs().gte("1000000000")) return `${formatDecimal(raw.div("1000000000").toString(),locale)} ${d.billion}`;
  if (raw.abs().gte("1000000")) return `${formatDecimal(raw.div("1000000").toString(),locale)} ${d.million}`;
  return `${formatDecimal(raw.toString(),locale,0)} ${d.madShort}`;
}
export function observationStatus(status: Observation["status"], locale: Locale) {
  const d=t(locale); return status === "estimated" ? d.estimated : status === "forecast" ? d.forecast : status === "provisional" ? `${d.official} · ${{fr:"provisoire",en:"provisional",ar:"أولية"}[locale]}` : d.official;
}
export function csvEscape(value: unknown) {
  let text = String(value ?? "");
  // Prevent spreadsheet formula injection in document titles and free text.
  if (/^[=+@\t\r]/.test(text) || (/^-/.test(text) && !/^-\d+(\.\d+)?$/.test(text))) text=`'${text}`;
  return `"${text.replaceAll('"','""')}"`;
}
export function observationsCsv(items: Observation[]) {
  const columns = ["id","indicatorId","exactValue","unit","scale","scope","period","referenceDate","publicationDate","status","sourceId","sourceUrl","documentTitle","documentPage","documentLocator","version"] as const;
  return "\uFEFF" + columns.map(csvEscape).join(",")+"\r\n"+items.map(item=>columns.map(key=>csvEscape(item[key])).join(",")).join("\r\n");
}
export function downloadText(text:string,name:string,type="text/csv;charset=utf-8") {
  const href=URL.createObjectURL(new Blob([text],{type})); const a=document.createElement("a"); a.href=href; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(href),1000);
}
