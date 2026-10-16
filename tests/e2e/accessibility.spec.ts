import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for(const path of ["/","/simulateur","/methodologie","/sources","/admin","/ar","/ar/simulateur"]){
  test(`WCAG automated checks ${path}`,async({page})=>{
    await page.goto(path);await page.locator("main h1").waitFor();
    const result=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
    expect(result.violations,result.violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target).join("; ")}`).join("\n")).toEqual([]);
  });
}
for(const path of ["/","/simulateur","/methodologie","/ar"]){
  test(`WCAG automated checks in dark mode ${path}`,async({page})=>{
    await page.addInitScript(()=>localStorage.setItem("mec-theme","dark"));
    await page.goto(path);await page.locator("main h1").waitFor();
    const result=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
    expect(result.violations,result.violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target).join("; ")}`).join("\n")).toEqual([]);
  });
}
