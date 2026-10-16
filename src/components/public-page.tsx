import Link from "next/link";
import { ArrowUpRight, ExternalLink, BookOpen, ShieldCheck, Database, CircleHelp, FlaskConical } from "lucide-react";
import { t, hrefFor, routeLabels, type Locale, type PublicRoute } from "@/lib/i18n";
import { editorial } from "@/lib/editorial";
import { getDashboardData, indicators, type IndicatorId, type DashboardData } from "@/lib/data";
import { loadDashboardData } from "@/lib/data/server";
import { IntegrationNotice } from "./integration-notice";
import { HistoryExplorer } from "./history-explorer";
import { FinancialCounter } from "./financial-counter";
import { MetricGrid } from "./metrics";
import { Simulator } from "./simulator";
import AdminConsole from "./admin/admin-console";

export async function PublicPage({locale,route}:{locale:Locale;route:PublicRoute|"admin"}) {
  const d=t(locale);const e=editorial(locale);const data:DashboardData=["admin","simulateur","methodologie","a-propos","comparateur"].includes(route)?getDashboardData():await loadDashboardData();const officialSources=data.sources;
  const desc:Record<string,string>={"dette-publique":e.debt,budget:e.budget,deficit:e.deficit,interets:e.interest,historique:e.history,comparateur:e.comparison,sources:e.sources,methodologie:e.methodology,"a-propos":e.about,simulateur:d.simulatorText,admin:d.independent};
  const title=route==="admin" ? d.admin:route==="simulateur"?d.simulatorTitle:d[routeLabels[route]];
  const metrics:Partial<Record<PublicRoute,IndicatorId[]>>={"dette-publique":["debt_domestic","debt_external","debt_gdp","debt_per_capita","debt_stock_change"],budget:["revenue","expenditure","deficit"],deficit:["deficit","debt_stock_change"],interets:["interest","debt_service"]};
  return <div className="container public-page"><div className="page-intro"><nav className="breadcrumb" aria-label={d.navigation}><Link href={hrefFor(locale)}>{d.home}</Link><span>/</span><span>{route==="admin"?d.admin:d[routeLabels[route]]}</span></nav><p className="eyebrow">{route==="simulateur" ? d.simulatorLabel : d.eyebrow}</p><h1>{title}</h1><p>{desc[route]}</p></div>
    {data.integrationStatus === "unavailable" && <IntegrationNotice locale={locale}/>}
    {route==="admin" ? <AdminConsole locale={locale}/> : route==="simulateur" ? <Simulator locale={locale}/> : route==="sources" ? <div className="source-library">{officialSources.map((source,i)=><article className="source-card" key={source.id}><div className="source-card-top"><span className="source-monogram">{source.abbreviation}</span><span className="source-index">0{i+1}</span></div><h2>{source.name}</h2><p>{source.description[locale]}</p><div className="source-documents"><BookOpen size={17}/><div><h3>{d.docs}</h3><p>{source.priorityDocuments[locale]}</p></div></div><span className="badge badge-pending">{source.status==="available"?d.official:d.notFetched}</span><div className="source-card-bottom"><a href={source.url} target="_blank" rel="noopener noreferrer">{d.visitInstitution}<ExternalLink size={15}/></a><small>{d.license}</small></div></article>)}</div> : route==="methodologie" ? <div className="methodology-layout"><aside className="method-sidebar"><ShieldCheck size={27}/><h2>{d.editorialTitle}</h2><p>{d.editorialText}</p><div className="method-statuses"><span className="badge badge-official">{d.official}</span><span className="badge badge-estimated">{d.estimated}</span><span className="badge badge-forecast">{d.forecast}</span></div></aside><div className="method-articles">{e.methodSections.map(([number,title,text])=><article key={number}><span>{number}</span><div><h2>{title}</h2><p>{text}</p></div></article>)}</div></div> : route==="a-propos" ? <div className="about-layout"><div className="about-brand"><Database size={40}/><h2>{d.brand}</h2><p>{d.tagline}</p><ShieldCheck size={25}/><p>{d.independent}</p></div><div className="about-copy">{e.aboutSections.map(([title,text])=><article key={title}><h2>{title}</h2><p>{text}</p></article>)}</div></div> : route==="comparateur" ? <><div className="notice"><CircleHelp size={23}/><p>{d.noComparisons}</p></div><div className="comparison-definitions"><h2>{d.definitions}</h2>{indicators.filter(i=>["debt_treasury","debt_general_government","debt_gdp"].includes(i.id)).map(i=><article key={i.id}><h3>{i.label[locale]}</h3><p>{i.description[locale]}</p><span className="badge badge-pending">{d.integrating}</span></article>)}</div></> : <>
      {route==="dette-publique" && <div className="debt-detail-clock"><FinancialCounter locale={locale} observation={data.latestDebt}/><div className="debt-explainer"><ShieldCheck size={28}/><h2>{d.definitions}</h2><p>{e.debt}</p><Link className="text-link" href={hrefFor(locale,"methodologie")}>{d.methodology}<ArrowUpRight size={17}/></Link></div></div>}
      {metrics[route] && <MetricGrid locale={locale} ids={metrics[route]!} byIndicator={data.byIndicator}/>}
      {route==="deficit" && <div className="notice"><CircleHelp size={22}/><p>{e.deficit}</p></div>}
      {route==="interets" && <div className="notice"><CircleHelp size={22}/><p>{e.interest}</p></div>}
      <HistoryExplorer locale={locale} items={data.observations} initialIndicator={route==="budget"?"revenue":route==="deficit"?"deficit":route==="interets"?"interest":"debt_treasury"} initialKind={route==="budget"?"bar":"line"}/>
      <div className="page-source-note"><BookOpen size={18}/><span>{d.sourcePending}</span><Link href={hrefFor(locale,"sources")}>{d.viewSources}<ArrowUpRight size={14}/></Link></div>
    </>}
    {route!=="simulateur" && route!=="admin" && <div className="page-bottom-link"><FlaskConical size={19}/><span>{d.simulateCall}</span><Link href={hrefFor(locale,"simulateur")}>{d.simulateAction}<ArrowUpRight size={15}/></Link></div>}
  </div>;
}
