"use client";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Clock3, ArrowUpRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { projectDebtStock, type DebtStockProjection } from "@/lib/finance";
import type { Observation } from "@/lib/data";
import { hrefFor, t, intlLocale, type Locale } from "@/lib/i18n";
import { formatDecimal, observationStatus } from "@/lib/format";
import { FinancialDecimal as Decimal } from "@/lib/finance/decimal";

export function FinancialCounter({ locale, observation, projection }: { locale:Locale; observation:Observation|null; projection?:DebtStockProjection }) {
  const d=t(locale); const reduce=useReducedMotion(); const [now,setNow]=useState<number|null>(null);
  useEffect(()=>{if (!projection) return; const id=setInterval(()=>setNow(Date.now()),1000); return ()=>clearInterval(id);},[projection]);
  let value=observation ? new Decimal(observation.exactValue).mul(observation.scale).toString() : null;
  let estimating=false;
  const scaleFactors={unit:1,thousand:1000,million:1000000,billion:1000000000} as const;
  const compatibleProjection=projection && observation && projection.anchor.indicatorId===observation.indicatorId && projection.anchor.scope===observation.scope && projection.anchor.unit===observation.unit && projection.anchor.referenceDate===observation.referenceDate && new Decimal(projection.anchor.value).mul(scaleFactors[projection.anchor.scale]).eq(value!);
  if (compatibleProjection && projection && now!==null) {
    try { const result=projectDebtStock(projection,new Date(now)); value=new Decimal(result.value).mul(({unit:1,thousand:1000,million:1000000,billion:1000000000} as const)[result.scale]).toString(); estimating=true; } catch { /* Keep the last official anchor outside the documented projection horizon. */ }
  }
  return <motion.section className="clock-panel" initial={false} animate={{opacity:1}} transition={{duration:reduce ? 0 : .5}} aria-label={d.nationalClock}>
    <div className="clock-top"><span><Clock3 size={15}/>{d.nationalClock}</span><span className="clock-tag"><span className="status-dot"/>{value ? estimating ? d.estimated : observationStatus(observation!.status,locale) : d.pending}</span></div>
    <p className="clock-label">{d.treasury}</p>
    <div className={`clock-digits ${value ? "" : "awaiting"}`} dir="ltr">{value ? formatDecimal(value,locale,0) : <><span>—</span><span>—</span><span>—</span></>}</div>
    <p className="clock-unit">{d.mad}</p>
    {value ? <p className="clock-context">{d.asOf} {new Intl.DateTimeFormat(intlLocale(locale)).format(new Date(observation!.referenceDate))}</p> : <><p className="clock-pending">{d.integrating}</p><p className="clock-description">{d.noDebt}</p></>}
    <div className="clock-bottom"><span><ShieldCheck size={15}/>{d.scope}</span><Link href={hrefFor(locale,"methodologie")}>{d.methodology}<ArrowUpRight size={14}/></Link></div>
    <p className="clock-note">{estimating ? projection!.method : d.noLive}</p>
    {observation && <a className="clock-source" href={observation.sourceUrl} target="_blank" rel="noopener noreferrer">{observation.documentTitle} · {observation.documentLocator}</a>}
  </motion.section>;
}
