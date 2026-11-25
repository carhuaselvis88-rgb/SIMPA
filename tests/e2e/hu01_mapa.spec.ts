import { test } from "@playwright/test";
import { entrar, evidencia, medir, expect } from "./ayuda";

test.describe("HU01 · Ver mapa de red y sectores", () => {
  test.beforeEach(async ({ page }) => { await entrar(page, "jefe@simpa.pe"); await expect(page.getByRole("heading", { name: "Tablero de indicadores" })).toBeVisible(); });

  test("HU01-E01 Carga del mapa del sector en menos de 3 s", async ({ page }, info) => {
    await page.goto("/#/mapa");
    const t0 = Date.now();
    await page.reload(); // carga en frío: descarga la aplicación y dibuja el mapa
    await expect(page.locator("path.tramo").first()).toBeAttached();
    await expect(page.locator("path.punto-Q-SP01-ENT")).toBeVisible();
    const ms = Date.now() - t0;
    medir(info, "Tiempo de carga del mapa", ms, "ms");
    await expect(page.locator("path.sector")).toHaveCount(3);
    await expect(page.locator("path.tramo")).toHaveCount(16);
    await expect(page.locator("path.valvula")).toHaveCount(4);
    expect(ms).toBeLessThan(3000);
    await evidencia(page, "HU01-E01");
  });

  test("HU01-E02 Activar y desactivar capas sin recargar", async ({ page }) => {
    await page.goto("/#/mapa");
    await expect(page.locator("path.valvula")).toHaveCount(4);
    const nav = await page.evaluate(() => performance.getEntriesByType("navigation").length);
    await page.getByLabel("Válvulas").uncheck();
    await expect(page.locator("path.valvula")).toHaveCount(0);
    await page.getByLabel("Colorear por antigüedad").check();
    await expect(page.getByLabel("Leyenda")).toContainText("Antes de 1985");
    expect(await page.evaluate(() => performance.getEntriesByType("navigation").length)).toBe(nav);
    await evidencia(page, "HU01-E02");
    await page.getByLabel("Válvulas").check();
    await expect(page.locator("path.valvula")).toHaveCount(4);
  });

  test("HU01-E03 Consultar un punto de medición", async ({ page }) => {
    await page.goto("/#/mapa");
    await page.locator("path.punto-Q-SP01-ENT").click({ force: true });
    const popup = page.locator(".leaflet-popup-content");
    await expect(popup).toContainText("Q-SP01-ENT");
    await expect(popup).toContainText(/Caudal: [\d.,]+ L\/s/);
    await expect(popup).toContainText(/Estado: (normal|en alerta|sin datos)/);
    await page.waitForTimeout(400); // fin de la animación de la ventana emergente
    await evidencia(page, "HU01-E03");
  });
});
