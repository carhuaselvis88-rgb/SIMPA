import { test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { entrar, medir, expect } from "./ayuda";

const RUTAS = ["tablero", "mapa", "sectores", "telemetria", "balance", "nocturno", "presiones", "submedicion", "alertas", "pasos", "ordenes", "campo", "usuarios", "rendimiento", "operacion", "accesibilidad"];

test("CAL-01 Accesibilidad WCAG 2.1 AA con axe-core en las 16 pantallas y el inicio de sesión", async ({ page }) => {
  const filas: { pantalla: string; violaciones: number; criticas: number; detalle: string[] }[] = [];
  const auditar = async (pantalla: string) => {
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude(".leaflet-container").analyze();
    filas.push({ pantalla, violaciones: r.violations.length, criticas: r.violations.filter((v) => v.impact === "critical" || v.impact === "serious").length, detalle: r.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length} nodos)`) });
  };
  await page.goto("/"); await auditar("login");
  await entrar(page, "jefe@simpa.pe");
  await expect(page.getByRole("heading", { name: "Tablero de indicadores" })).toBeVisible();
  for (const r of RUTAS) { await page.goto("/#/" + r); await page.locator("#titulo-pagina").waitFor(); await page.waitForTimeout(300); await auditar(r); }
  fs.mkdirSync("reports", { recursive: true });
  fs.writeFileSync("reports/axe.json", JSON.stringify(filas, null, 1));
  const graves = filas.reduce((a, f) => a + f.criticas, 0);
  expect(graves, JSON.stringify(filas.filter((f) => f.violaciones), null, 1)).toBe(0);
});

test("CAL-02 Rendimiento medido en la aplicación (latencia, carga y cálculo anual)", async ({ page }, info) => {
  test.setTimeout(90000);
  await entrar(page, "jefe@simpa.pe");
  await expect(page.getByRole("heading", { name: "Tablero de indicadores" })).toBeVisible();
  await page.goto("/#/telemetria");
  await page.waitForTimeout(42000); // ~10 emisiones del simulador × 5 puntos
  await page.goto("/#/rendimiento");
  const kpi = async (et: string) => (await page.locator(".kpi", { hasText: et }).locator(".v").textContent())!;
  const p50 = await kpi("Latencia p50"), p95 = await kpi("Latencia p95");
  const muestras = await page.locator(".kpi", { hasText: "Latencia p50" }).textContent();
  await page.getByRole("button", { name: "Ejecutar prueba" }).click();
  const bench = await page.getByTestId("bench").textContent();
  const num = (s: string) => Number(s.replace(/[^\d.]/g, ""));
  medir(info, "Latencia p50 lectura→pantalla", num(p50), "ms");
  medir(info, "Latencia p95 lectura→pantalla", num(p95), "ms");
  medir(info, "Muestras de latencia", num(muestras!.match(/(\d+) muestras/)![1]), "lecturas");
  medir(info, "Cálculo de un año de balance", num(bench!.match(/en ([\d.,]+) ms/)![1].replace(",", "")), "ms");
  await page.screenshot({ path: "reports/evidencias/CAL-02.png" });
  expect(num(p95)).toBeLessThan(5000);
});
