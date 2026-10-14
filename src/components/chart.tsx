"use client";
import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { LineChart, BarChart, PieChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, AriaComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import { ImageDown, ChartNoAxesCombined } from "lucide-react";
import { Button } from "./ui/button";
import { t, intlLocale, type Locale } from "@/lib/i18n";
echarts.use([LineChart,BarChart,PieChart,GridComponent,TooltipComponent,LegendComponent,DataZoomComponent,AriaComponent,CanvasRenderer]);

export interface ChartSeries { name:string; values:(number|null)[]; color?:string }
export function DataChart({labels,series,locale,kind="line",unit="",title}: {labels:string[];series:ChartSeries[];locale:Locale;kind?:"line"|"bar"|"pie";unit?:string;title:string}) {
  const container=useRef<HTMLDivElement>(null); const instance=useRef<echarts.ECharts|null>(null); const [themeRevision,setThemeRevision]=useState(0); const d=t(locale);
  const hasData=labels.length>0 && series.some(s=>s.values.length>0);
  useEffect(()=>{const handle=()=>setThemeRevision(v=>v+1);window.addEventListener("mec-theme-change",handle); return ()=>window.removeEventListener("mec-theme-change",handle);},[]);
  useEffect(()=>{
    if (!container.current || !hasData) return;
    const root=getComputedStyle(document.documentElement); const ink=root.getPropertyValue("--ink").trim(); const muted=root.getPropertyValue("--muted").trim(); const border=root.getPropertyValue("--border").trim();
    const chart=echarts.init(container.current,undefined,{renderer:"canvas"}); instance.current=chart;
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const option:EChartsOption={
      animation:!reduced,animationDuration:500,color:["#269f83","#d1b679","#5793bc"],aria:{enabled:true,decal:{show:true}},
      textStyle:{fontFamily:"inherit",color:ink},tooltip:{trigger:kind === "pie" ? "item":"axis",confine:true,valueFormatter:value=>typeof value==="number"?new Intl.NumberFormat(intlLocale(locale),{maximumFractionDigits:2}).format(value):String(value)},
      legend:{bottom:kind === "pie" ? 0:38,textStyle:{color:muted}},
      ...(kind === "pie" ? {} : {grid:{top:20,left:16,right:18,bottom:90,containLabel:true},xAxis:{type:"category",data:labels,axisLabel:{color:muted},axisLine:{lineStyle:{color:border}}},yAxis:{type:"value",name:unit,axisLabel:{color:muted},splitLine:{lineStyle:{color:border}}},dataZoom:[{type:"inside"},{type:"slider",height:18,bottom:5,borderColor:border}]}),
      series:kind === "pie" ? [{type:"pie",radius:["50%","75%"],center:["50%","43%"],label:{color:ink},data:labels.map((name,i)=>({name,value:series[0]?.values[i] ?? 0}))}] : series.map(s=>({type:kind,name:s.name,data:s.values,smooth:false,showSymbol:labels.length<20,itemStyle:{color:s.color},lineStyle:{width:3},...(kind === "line" ? {areaStyle:{opacity:.07}} : {barMaxWidth:36})})),
    };
    chart.setOption(option);const resize=new ResizeObserver(()=>chart.resize());resize.observe(container.current);
    return ()=>{resize.disconnect();chart.dispose();instance.current=null;};
  },[labels,series,hasData,kind,unit,themeRevision,locale]);
  function exportImage(){if(!instance.current)return;const a=document.createElement("a");a.href=instance.current.getDataURL({type:"png",pixelRatio:2,backgroundColor:getComputedStyle(document.documentElement).getPropertyValue("--surface").trim()});a.download="maroc-en-chiffres.png";a.click();}
  if (!hasData) return <div className="chart-empty"><div className="chart-grid" aria-hidden="true"/><div className="chart-empty-content"><span><ChartNoAxesCombined size={28}/></span><h3>{d.noSeries}</h3><p>{d.noSeriesText}</p><span className="badge badge-pending">{d.integrating}</span></div></div>;
  return <div className="data-chart"><div ref={container} className="echart" role="img" aria-label={title}/><div className="chart-actions"><Button variant="ghost" size="sm" onClick={exportImage}><ImageDown size={16}/>{d.exportImage}</Button></div><details className="chart-table"><summary>{d.accessibility}</summary><div className="table-scroll"><table><caption>{title}</caption><thead><tr><th>{d.period}</th>{series.map(s=><th key={s.name}>{s.name} ({unit})</th>)}</tr></thead><tbody>{labels.map((label,i)=><tr key={label}><th>{label}</th>{series.map(s=><td key={s.name}>{s.values[i]}</td>)}</tr>)}</tbody></table></div></details></div>;
}
