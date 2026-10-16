import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { publicRoutes, hrefFor } from "../../src/lib/i18n";

test("all public routes render in three languages and reject unknown routes",async({request})=>{
  for(const locale of ["fr","en","ar"] as const){for(const route of ["",...publicRoutes,"admin"]){const response=await request.get(hrefFor(locale,route));expect(response.status(),`${locale}/${route}`).toBe(200);const html=await response.text();expect(html).toContain(`lang="${locale}"`);if(locale==="ar")expect(html).toContain('dir="rtl"');}}
  expect((await request.get("/unknown-page")).status()).toBe(404);
  expect((await request.get("/ar/budget/unknown")).status()).toBe(404);
});
test("homepage presents no fabricated debt values and has functional navigation",async({page})=>{
  await page.goto("/");await expect(page.getByRole("heading",{level:1})).toContainText("Les chiffres d’un pays.");
  await expect(page.getByRole("region",{name:"L’horloge nationale"})).toContainText("Données en cours d’intégration");
  await expect(page.locator(".clock-digits")).toHaveText("———");
  await page.getByRole("link",{name:"Explorer la dette"}).click();await expect(page).toHaveURL(/dette-publique$/);
  await expect(page.getByRole("heading",{level:1})).toHaveText("Dette publique");
});
test("simulator updates a real scenario and exports exact calculations",async({page})=>{
  await page.goto("/simulateur");await expect(page.locator(".simulation-kpis")).toContainText("56,3");
  await page.getByLabel("Croissance nominale du PIB (%)",{exact:true}).fill("8");await page.getByRole("button",{name:"Calculer le scénario"}).click();
  await expect(page.locator(".simulation-kpis")).toContainText("38,6");
  await expect(page.locator(".simulation-notice")).toContainText("Simulation illustrative");
  const download=page.waitForEvent("download");await page.getByRole("button",{name:"Télécharger le CSV"}).click();expect((await download).suggestedFilename()).toBe("maroc-simulation.csv");
  const pngDownload=page.waitForEvent("download");await page.getByRole("button",{name:"Exporter le graphique"}).click();const png=await pngDownload;expect(png.suggestedFilename()).toBe("maroc-en-chiffres.png");const pngPath=await png.path();expect(pngPath).not.toBeNull();const bytes=await readFile(pngPath!);expect(bytes.subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
});
test("scenario validation preserves last valid output",async({page})=>{
  await page.goto("/simulateur");const before=await page.locator(".simulation-kpis").textContent();await page.getByLabel("Variation nette annuelle du stock (Mds MAD)").fill("-500");await page.getByRole("button",{name:"Calculer le scénario"}).click();await expect(page.locator("main").getByRole("alert")).toBeVisible();expect(await page.locator(".simulation-kpis").textContent()).toBe(before);
});
test("theme persists and Arabic document semantics are correct",async({page})=>{
  await page.goto("/");await page.locator(".header-actions>.btn-icon").first().click();await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await page.getByRole("link",{name:"ع",exact:true}).click();await expect(page).toHaveURL(/\/ar\/?$/);await expect(page.locator("html")).toHaveAttribute("dir","rtl");await expect(page.locator("html")).toHaveAttribute("lang","ar");await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
});
test("mobile menu and layouts do not overflow",async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto("/");await page.getByRole("button",{name:"Ouvrir le menu"}).click();await page.locator("#mobile-navigation").getByRole("link",{name:"Budget",exact:true}).click();await expect(page).toHaveURL(/budget$/);
  for(const path of ["/","/simulateur","/sources","/ar","/ar/simulateur","/admin"]){await page.goto(path);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),path).toBe(true);}
});
test("admin endpoints reject anonymous access and return no private payload",async({request})=>{
  const response=await request.get("/api/admin/observations");expect([401,503]).toContain(response.status());const payload=await response.json();expect(payload).toHaveProperty("error");expect(payload).not.toHaveProperty("observations");
  const forbidden=await request.post("/api/admin/observations",{data:{value:"42"}});expect([401,503]).toContain(forbidden.status());
});
test("response headers and SEO routes are present",async({request})=>{
  const response=await request.get("/");expect(response.headers()["x-frame-options"]).toBe("DENY");expect(response.headers()["x-content-type-options"]).toBe("nosniff");expect((await request.get("/robots.txt")).status()).toBe(200);expect((await request.get("/sitemap.xml")).status()).toBe(200);expect((await request.get("/opengraph-image.svg")).status()).toBe(200);
});
