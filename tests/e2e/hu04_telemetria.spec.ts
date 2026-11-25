import { test } from "@playwright/test";
import { entrar, evidencia, medir, expect } from "./ayuda";

test.describe("HU04 · Recibir telemetría por API y simulador", () => {
  test.beforeEach(async ({ page }) => { await entrar(page, "operador@simpa.pe"); await expect(page.getByRole("heading", { name: "Tablero de indicadores" })).toBeVisible(); await page.goto("/#/telemetria"); });

  test("HU04-E01 Lectura válida por API (201, origen api)", async ({ page }) => {
    await page.getByLabel("Punto", { exact: true }).last().selectOption("Q-SP01-ENT");
    await page.getByLabel("Valor").fill("24.8");
    await page.getByRole("button", { name: "Enviar lectura" }).click();
    const r = page.getByTestId("respuesta-api");
    await expect(r).toContainText("HTTP 201");
    await expect(r).toContainText('"valor":24.8');
    const guardada = await page.evaluate(() => JSON.parse(localStorage.getItem("simpa:v1")!).lecturasExtra.at(-1));
    expect(guardada).toMatchObject({ punto: "Q-SP01-ENT", valor: 24.8, origen: "api" });
    await evidencia(page, "HU04-E01");
  });

  test("HU04-E02 Lectura duplicada o imposible (422 y bitácora de rechazos)", async ({ page }) => {
    const hoy = await page.evaluate(() => { const d = new Date(); d.setHours(3, 0, 0, 0); const l = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return l.toISOString().slice(0, 16); });
    await page.getByLabel("Fecha y hora").fill(hoy);
    await page.getByRole("button", { name: "Enviar lectura" }).click();
    await expect(page.getByTestId("respuesta-api")).toContainText("HTTP 422");
    await expect(page.getByTestId("respuesta-api")).toContainText("duplicada");
    await page.getByLabel("Punto", { exact: true }).last().selectOption("P-SP01-01");
    await page.getByLabel("Valor").fill("-5");
    await page.getByRole("button", { name: "Enviar lectura" }).click();
    await expect(page.getByTestId("respuesta-api")).toContainText("presión negativa");
    const n = await page.evaluate(() => JSON.parse(localStorage.getItem("simpa:v1")!).rechazos.length);
    expect(n).toBe(2);
    await expect(page.getByText("422 presión negativa")).toBeVisible();
    await evidencia(page, "HU04-E02");
  });

  test("HU04-E03 Token inválido (401, sin registro)", async ({ page }) => {
    await page.getByLabel("Token").fill("tok-vencido-0000");
    await page.getByRole("button", { name: "Enviar lectura" }).click();
    await expect(page.getByTestId("respuesta-api")).toContainText("HTTP 401");
    const extra = await page.evaluate(() => JSON.parse(localStorage.getItem("simpa:v1")!).lecturasExtra.length);
    expect(extra).toBe(0);
    await evidencia(page, "HU04-E03");
  });

  test("HU04-E04 Simulador del gemelo digital registra lecturas de todos los puntos", async ({ page }, info) => {
    const resumen = page.getByText(/lecturas · última/);
    const antes = Number((await resumen.textContent())!.match(/([\d,.]+) lecturas/)![1].replace(/[,.]/g, ""));
    const t0 = Date.now();
    await expect.poll(async () => Number((await resumen.textContent())!.match(/([\d,.]+) lecturas/)![1].replace(/[,.]/g, "")), { timeout: 10000 }).toBeGreaterThan(antes);
    medir(info, "Tiempo hasta ver la nueva lectura del simulador", Date.now() - t0, "ms");
    for (const p of ["Q-SP01-ENT", "P-SP01-01", "P-SP01-02", "P-SP01-03"]) await expect(page.locator(".kpi", { hasText: p })).toContainText("normal");
    await evidencia(page, "HU04-E04");
  });
});
