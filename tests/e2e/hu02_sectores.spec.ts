import { test } from "@playwright/test";
import { entrar, evidencia, expect } from "./ayuda";

const poli = (x: number, y: number) => [[[x, y], [x + 0.006, y], [x + 0.006, y - 0.005], [x, y - 0.005], [x, y]]];
const fc = (features: unknown[]) => JSON.stringify({ type: "FeatureCollection", features });
const f = (codigo: string, nombre: string, coords: unknown) => ({ type: "Feature", properties: { codigo, nombre }, geometry: { type: "Polygon", coordinates: coords } });

test.describe("HU02 · Gestionar sectores y puntos de medición", () => {
  test.beforeEach(async ({ page }) => { await entrar(page, "jefe@simpa.pe"); await expect(page.getByRole("heading", { name: "Tablero de indicadores" })).toBeVisible(); await page.goto("/#/sectores"); });

  test("HU02-E01 Importación válida de 3 sectores", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Sectores registrados \(3\)/ })).toBeVisible();
    await page.getByLabel("Archivo GeoJSON").setInputFiles({ name: "sectores.geojson", mimeType: "application/json", buffer: Buffer.from(fc([f("SP-04", "Santa Úrsula", poli(-71.951, -13.522)), f("SP-05", "Tahuantinsuyo", poli(-71.944, -13.522)), f("SP-06", "Ttio", poli(-71.951, -13.528))])) });
    await expect(page.getByRole("status").filter({ hasText: "Se importaron 3 sectores" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Sectores registrados \(6\)/ })).toBeVisible();
    await evidencia(page, "HU02-E01");
    await page.goto("/#/mapa");
    await expect(page.locator("path.sector-SP-04")).toBeVisible();
    await expect(page.locator("path.sector")).toHaveCount(6);
  });

  test("HU02-E02 Geometría inválida en la fila 2: no se guarda nada", async ({ page }) => {
    const cruzado = [[[-71.944, -13.522], [-71.938, -13.527], [-71.938, -13.522], [-71.944, -13.527], [-71.944, -13.522]]];
    await page.getByLabel("O pegue el contenido").fill(fc([f("SP-04", "Santa Úrsula", poli(-71.951, -13.522)), f("SP-05", "Tahuantinsuyo", cruzado), f("SP-06", "Ttio", poli(-71.951, -13.528))]));
    await page.getByRole("button", { name: "Importar", exact: true }).click();
    const alerta = page.getByRole("alert");
    await expect(alerta).toContainText("fila 2");
    await expect(alerta).toContainText(/se cruza|intersec/i);
    await expect(alerta).toContainText("No se guardó ningún sector");
    await expect(page.getByRole("heading", { name: /Sectores registrados \(3\)/ })).toBeVisible();
    await evidencia(page, "HU02-E02");
  });

  test("HU02-E03 Sector sin punto de entrada bloquea el balance", async ({ page }) => {
    const fila = page.getByRole("row", { name: /^SP-03/ });
    await fila.getByRole("button", { name: "Verificar" }).click();
    await expect(fila).toContainText("Defina al menos un punto de entrada");
    const piloto = page.getByRole("row", { name: /^SP-01 piloto/ });
    await piloto.getByRole("button", { name: "Verificar" }).click();
    await expect(piloto).toContainText("Listo para calcular");
    await evidencia(page, "HU02-E03");
  });
});
