import { Info, ArrowUpRight } from "lucide-react";
import type { IndicatorId, Observation } from "@/lib/data";
import { getIndicatorById, getSourceById } from "@/lib/data";
import { t, indicatorLabel, type Locale } from "@/lib/i18n";
import { formatObservation, observationStatus } from "@/lib/format";
import { formatDecimal } from "@/lib/format";
import { annualFlowPerDay, annualFlowPerSecond, daysInYear, secondsInYear } from "@/lib/finance";
import { FinancialDecimal } from "@/lib/finance/decimal";
export function Metric({id,observation,locale}: {id:IndicatorId;observation?:Observation;locale:Locale}) {
  const d=t(locale); const definition=getIndicatorById(id);
  return <article className="metric"><div className="metric-heading"><h3>{indicatorLabel(id,locale)}</h3><details className="metric-help"><summary aria-label={`${d.definitions} : ${indicatorLabel(id,locale)}`}><Info size={15}/></summary><div>{definition?.description[locale]}{observation && <p>{d.period}: {observation.period}<br/>{d.scopeLabel}: {definition?.scope}<br/>{d.source}: {observation.documentTitle}</p>}</div></details></div><p className="metric-value" dir="ltr">{observation ? formatObservation(observation,locale) : "—"}</p><div className="metric-foot"><span className={`badge ${observation ? "badge-official" : "badge-pending"}`}>{observation ? observationStatus(observation.status,locale) : d.pending}</span>{observation && <a href={observation.sourceUrl} target="_blank" rel="noopener noreferrer">{getSourceById(observation.sourceId)?.abbreviation}<ArrowUpRight size={12}/></a>}</div></article>;
}
export function MetricGrid({ids,byIndicator,locale}: {ids:IndicatorId[];byIndicator:Partial<Record<IndicatorId,Observation>>;locale:Locale}) {
  return <div className="metrics-grid">{ids.map(id=><Metric key={id} id={id} observation={byIndicator[id]} locale={locale}/>)}</div>;
}
export function DerivedFlowMetric({type,observation,locale}:{type:"second"|"day";observation?:Observation;locale:Locale}) {
  const d=t(locale);const year=observation?Number(observation.referenceDate.slice(0,4)):null;
  const annual=observation && observation.unit==="MAD" && /^\d{4}$/.test(observation.period) && (!observation.provenance || (observation.provenance.frequency==="annual" && observation.provenance.periodStart===`${year}-01-01` && observation.provenance.periodEnd===`${year}-12-31`));
  const label=type==="second"?d.perSecond:d.perDay;
  const exact=annual?new FinancialDecimal(observation.exactValue).mul(observation.scale).toFixed():null;
  const value=exact&&year ? (type==="second"?annualFlowPerSecond(exact,year):annualFlowPerDay(exact,year)):null;
  const explanation={fr:"Moyenne calculée à partir du flux annuel documenté, pas une mesure instantanée ni une échéance réelle.",en:"Average calculated from a documented annual flow; it is not an instantaneous measurement or an actual repayment.",ar:"متوسط محسوب من تدفق سنوي موثق وليس قياساً فورياً أو دفعة فعلية."}[locale];
  return <article className="metric"><div className="metric-heading"><h3>{label}</h3><details className="metric-help"><summary aria-label={`${d.method}: ${label}`}><Info size={15}/></summary><div>{explanation}{year && <p>{d.method}: {type==="second"?secondsInYear(year):daysInYear(year)} · {year}</p>}</div></details></div><p className="metric-value" dir="ltr">{value?`${formatDecimal(value,locale,type==="second"?2:0)} ${d.madShort}`:"—"}</p><div className="metric-foot"><span className={`badge ${value?"badge-estimated":"badge-pending"}`}>{value?d.estimated:d.pending}</span>{value&&observation&&<a href={observation.sourceUrl} target="_blank" rel="noopener noreferrer">{d.source}<ArrowUpRight size={12}/></a>}</div></article>;
}
