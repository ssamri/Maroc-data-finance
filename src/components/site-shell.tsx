"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Menu, X, Moon, Sun, ArrowUpRight, BarChart3, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hrefFor, t, type Locale, publicRoutes, routeLabels } from "@/lib/i18n";

function subscribeTheme(callback:()=>void){window.addEventListener("mec-theme-change",callback);return ()=>window.removeEventListener("mec-theme-change",callback);}
function readTheme(){return document.documentElement.dataset.theme??"light";}
export function SiteHeader({locale}: {locale:Locale}) {
  const d = t(locale); const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const theme=useSyncExternalStore(subscribeTheme,readTheme,()=>"light");
  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next; try {localStorage.setItem("mec-theme", next);} catch { /* The active theme still works when storage is unavailable. */ }
    window.dispatchEvent(new Event("mec-theme-change"));
  }
  const slug = pathname.replace(/^\/(en|ar)(?=\/|$)/, "").replace(/^\//, "");
  const links = [["",d.home],["dette-publique",d.debt],["budget",d.budget],["historique",d.history],["sources",d.sources]];
  return <>
    <div className="topline"><div className="container"><span><span className="status-dot"/>{d.eyebrow}</span><span className="topline-note">{d.independent}</span></div></div>
    <header className="site-header"><div className="container header-inner">
      <Link className="brand" href={hrefFor(locale)} aria-label={d.brand}><span className="brand-mark"><BarChart3 size={23}/></span><span><strong>{d.brand}</strong><small>{d.tagline}</small></span></Link>
      <nav className="desktop-nav" aria-label={d.navigation}>{links.map(([path,label])=><Link key={path} href={hrefFor(locale,path)} className={slug === path ? "active" : ""}>{label}</Link>)}</nav>
      <div className="header-actions"><div className="language-switch" aria-label={d.language}><Globe2 size={14}/>{(["fr","ar","en"] as const).map(code=><a key={code} href={hrefFor(code,slug)} aria-current={locale === code ? "true" : undefined} lang={code}>{code === "ar" ? "ع" : code.toUpperCase()}</a>)}</div>
      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={theme === "light" ? d.dark : d.light}><Sun className="theme-sun" size={18}/><Moon className="theme-moon" size={18}/></Button>
      <Button asChild className="header-sim" size="sm"><Link href={hrefFor(locale,"simulateur")}>{d.simulator}<ArrowUpRight size={15}/></Link></Button>
      <Button variant="ghost" size="icon" className="mobile-toggle" aria-label={menu ? d.close : d.menu} aria-expanded={menu} aria-controls="mobile-navigation" onClick={()=>setMenu(!menu)}>{menu ? <X size={20}/> : <Menu size={20}/>}</Button></div>
    </div>{menu && <nav id="mobile-navigation" className="mobile-nav container" aria-label={d.navigation}>{links.map(([path,label])=><Link key={path} href={hrefFor(locale,path)} onClick={()=>setMenu(false)}>{label}</Link>)}<Link href={hrefFor(locale,"simulateur")} onClick={()=>setMenu(false)}>{d.simulator}</Link></nav>}</header>
  </>;
}
export function SiteFooter({locale}:{locale:Locale}) {
  const d=t(locale);
  return <footer className="site-footer"><div className="container"><div className="footer-top"><div><Link className="brand" href={hrefFor(locale)}><span className="brand-mark"><BarChart3 size={22}/></span><strong>{d.brand}</strong></Link><p>{d.footerText}</p></div><nav aria-label={d.navigation}>{publicRoutes.map(path=><Link key={path} href={hrefFor(locale,path)}>{d[routeLabels[path]]}</Link>)}</nav></div><div className="footer-bottom"><p>{d.independent}<br/><small>{d.rights}</small></p><Link href={hrefFor(locale,"admin")}>{d.admin}<ArrowUpRight size={13}/></Link></div></div></footer>;
}
