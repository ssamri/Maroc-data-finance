"use client";
import { useMemo, useState } from "react";
import Decimal from "decimal.js";
import { Download, ListFilter } from "lucide-react";
import { DataChart } from "./chart";
import { Button } from "./ui/button";
import { indicators, latestApprovedRevisions, getComparableSeriesKey, type IndicatorId, type Observation } from "@/lib/data";
import { t, intlLocale, indicatorLabel, type Locale } from "@/lib/i18n";
import { formatObservation, observationStatus, downloadText, observationsCsv } from "@/lib/format";

export function HistoryExplorer({locale,items,compact=false,initialIndicator="debt_treasury",initialKind="line"}: {locale:Locale;items:Observation[];compact?:boolean;initialIndicator?:IndicatorId;initialKind?:"line"|"bar"}) {
  const d=t(locale);const [indicator,setIndicator]=useState<IndicatorId>(initialIndicator);const [from,setFrom]=useState("");const [to,setTo]=useState("");const [kind,setKind]=useState<"line"|"bar">(initialKind);
  const years=useMemo(()=>[...new Set(items.map(item=>item.referenceDate.slice(0,4)))].sort(),[items]);
  const filtered=useMemo(()=>latestApprovedRevisions(items).filter(item=>item.indicatorId===indicator && (!from || item.referenceDate.slice(0,4)>=from) && (!to || item.referenceDate.slice(0,4)<=to)).sort((a,b)=>a.referenceDate.localeCompare(b.referenceDate)),[items,indicator,from,to]);
  const definition=indicators.find(i=>i.id===indicator)!;
  // Keep scopes separate, even when a future dataset contains several definitions.
  const seriesKeys=useMemo(()=>[...new Set(filtered.map(getComparableSeriesKey))],[filtered]);
  const labels=useMemo(()=>[...new Set(filtered.map(item=>item.referenceDate))].sort(),[filtered]);
  const factor=definition.unit==="MAD" ? "1000000000":"1";
  const series=useMemo(()=>{
    const groups=new Map<string,Map<string,Observation>>();
    for(const item of filtered){const key=getComparableSeriesKey(item);const group=groups.get(key)??new Map<string,Observation>();group.set(item.referenceDate,item);groups.set(key,group);}
    return seriesKeys.map((key,index)=>{const group=groups.get(key)!;const sample=group.values().next().value!;return {name:`${indicatorLabel(indicator,locale)}${seriesKeys.length>1?` · ${index+1} · v${sample.provenance?.definitionVersion??1}`:""}`,values:labels.map(date=>{const item=group.get(date);return item ? new Decimal(item.exactValue).mul(item.scale).div(factor).toNumber() : null;})};});
  },[seriesKeys,labels,filtered,factor,indicator,locale]);
  const unit=definition.unit==="MAD" ? d.billion:definition.unit==="percent" ? "%":d.population;
  return <div className="history-explorer"><div className="chart-toolbar"><div className="chart-filter"><ListFilter size={16}/><label className="sr-only" htmlFor={compact?"home-indicator":"history-indicator"}>{d.indicator}</label><select id={compact?"home-indicator":"history-indicator"} value={indicator} onChange={e=>setIndicator(e.target.value as IndicatorId)}>{indicators.map(i=><option key={i.id} value={i.id}>{i.label[locale]}</option>)}</select></div><div className="chart-toolbar-end"><div className="segmented" aria-label={d.filter}><button className={kind==="line" ? "selected":""} aria-pressed={kind==="line"} onClick={()=>setKind("line")}>{d.line}</button><button className={kind==="bar" ? "selected":""} aria-pressed={kind==="bar"} onClick={()=>setKind("bar")}>{d.bar}</button></div><Button variant="ghost" size="sm" disabled={!filtered.length} onClick={()=>downloadText(observationsCsv(filtered),`maroc-${indicator}.csv`)}><Download size={15}/>{d.exportCsv}</Button></div></div>
    {!compact && <div className="period-filters"><label>{d.from}<select value={from} onChange={e=>setFrom(e.target.value)}><option value="">{d.allYears}</option>{years.map(y=><option key={y}>{y}</option>)}</select></label><label>{d.to}<select value={to} onChange={e=>setTo(e.target.value)}><option value="">{d.allYears}</option>{years.map(y=><option key={y}>{y}</option>)}</select></label><Button variant="ghost" onClick={()=>{setFrom("");setTo("");}}>{d.reset}</Button></div>}
    <DataChart labels={labels} series={series} locale={locale} kind={kind} unit={unit} title={definition.label[locale]}/>
    {!compact && <div className="table-scroll observation-table"><table><caption>{d.table}</caption><thead><tr><th>{d.period}</th><th>{d.value}</th><th>{d.scopeLabel}</th><th>{d.source}</th><th>{d.official}</th></tr></thead><tbody>{filtered.length ? filtered.map(item=><tr key={item.id}><td>{new Intl.DateTimeFormat(intlLocale(locale),{year:"numeric",month:"short",day:"numeric"}).format(new Date(item.referenceDate))}</td><td dir="ltr">{formatObservation(item,locale)}</td><td>{item.scope}</td><td><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.documentTitle} · {item.documentLocator}</a></td><td>{observationStatus(item.status,locale)}</td></tr>):<tr><td colSpan={5}>{d.noResults}</td></tr>}</tbody></table></div>}
  </div>;
}
