import Link from "next/link";
import { ArrowUpRight, ArrowRight, BookOpen, Database, ShieldCheck, SlidersHorizontal, Globe2 } from "lucide-react";
import { Button } from "./ui/button";
import { FinancialCounter } from "./financial-counter";
import { MetricGrid, Metric, DerivedFlowMetric } from "./metrics";
import { HistoryExplorer } from "./history-explorer";
import { officialSources } from "@/lib/data";
import { loadDashboardData } from "@/lib/data/server";
import { IntegrationNotice } from "./integration-notice";
import { hrefFor, t, type Locale } from "@/lib/i18n";

export async function Home({locale}:{locale:Locale}) {
  const d=t(locale); const data=await loadDashboardData();
  return <>
    {data.integrationStatus === "unavailable" && <div className="container"><IntegrationNotice locale={locale}/></div>}
    <section className="hero container"><div className="hero-copy"><p className="eyebrow"><span/>{d.eyebrow}</p><h1>{d.heroTitle}<br/><em>{d.heroAccent}</em></h1><p className="hero-description">{d.heroText}</p><div className="hero-actions"><Button asChild><Link href={hrefFor(locale,"dette-publique")}>{d.explore}<ArrowUpRight size={17}/></Link></Button><Link className="text-link" href={hrefFor(locale,"methodologie")}>{d.understand}<ArrowRight size={16}/></Link></div><div className="hero-trust"><ShieldCheck size={16}/><span>{d.official}</span><span className="trust-separator"/><span>{d.methodology}</span></div></div><FinancialCounter locale={locale} observation={data.latestDebt}/></section>
    <div className="container"><div className="section-heading"><div><p className="eyebrow">01 / {d.home}</p><h2>{d.snapshot}</h2><p>{d.snapshotText}</p></div><div className="status-legend"><span><i className="legend-official"/>{d.official}</span><span><i className="legend-estimated"/>{d.estimated}</span><span><i className="legend-forecast"/>{d.forecast}</span></div></div><MetricGrid locale={locale} ids={["debt_per_capita","debt_gdp","debt_domestic","debt_external"]} byIndicator={data.byIndicator}/></div>
    <section className="history-section container"><div className="section-heading"><div><p className="eyebrow">02 / {d.history}</p><h2>{d.chartTitle}</h2><p>{d.chartSubtitle}</p></div><Link className="text-link" href={hrefFor(locale,"historique")}>{d.viewHistory}<ArrowUpRight size={17}/></Link></div><HistoryExplorer locale={locale} items={data.observations} compact/></section>
    <section className="editorial"><div className="container editorial-inner"><div className="editorial-copy"><p className="eyebrow">03 / {d.methodology}</p><h2>{d.editorialTitle}</h2><p>{d.editorialText}</p><Button asChild variant="outline"><Link href={hrefFor(locale,"methodologie")}>{d.methodology}<ArrowUpRight size={16}/></Link></Button></div><div className="editorial-principles">{[[Database,d.editorial1,d.editorial1Text],[BookOpen,d.editorial2,d.editorial2Text],[ShieldCheck,d.editorial3,d.editorial3Text]].map(([Icon,title,text],i)=>{const Component=Icon as typeof Database;return <article key={i}><span className="principle-number">0{i+1}</span><div><Component size={21}/><h3>{String(title)}</h3><p>{String(text)}</p></div></article>;})}</div></div></section>
    <section className="container other-indicators"><div className="section-heading"><div><p className="eyebrow">04 / {d.budget}</p><h2>{d.budget} & {d.interest.toLowerCase()}</h2></div><Link className="text-link" href={hrefFor(locale,"budget")}>{d.budget}<ArrowUpRight size={16}/></Link></div><div className="metrics-grid">{(["debt_stock_change","interest","deficit","revenue","expenditure","debt_service"] as const).map(id=><Metric key={id} id={id} observation={data.byIndicator[id]} locale={locale}/>)}<DerivedFlowMetric type="second" observation={data.byIndicator.debt_stock_change} locale={locale}/><DerivedFlowMetric type="day" observation={data.byIndicator.interest} locale={locale}/></div></section>
    <section className="container simulator-callout"><div className="sim-call-icon"><SlidersHorizontal size={30}/></div><div><p className="eyebrow">{d.forecast}</p><h2>{d.simulateCall}</h2><p>{d.simulateCallText}</p></div><Button asChild><Link href={hrefFor(locale,"simulateur")}>{d.simulateAction}<ArrowUpRight size={17}/></Link></Button></section>
    <section className="container home-sources"><div className="section-heading"><div><p className="eyebrow">05 / {d.sources}</p><h2>{d.libraryTitle}</h2><p>{d.libraryText}</p></div><Link className="text-link" href={hrefFor(locale,"sources")}>{d.viewSources}<ArrowUpRight size={17}/></Link></div><div className="source-ribbon">{officialSources.slice(0,6).map(source=><a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer"><Globe2 size={19}/><strong>{source.abbreviation}</strong><ArrowUpRight size={13}/></a>)}</div></section>
  </>;
}
