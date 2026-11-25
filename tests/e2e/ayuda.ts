import { expect, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs";

export const CLAVE = "Simpa2026!";

export async function entrar(page: Page, correo: string, clave = CLAVE) {
  await page.goto("/");
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Contraseña").fill(clave);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

/** Guarda la captura de evidencia con el código del escenario. */
export async function evidencia(page: Page, nombre: string) {
  fs.mkdirSync("reports/evidencias", { recursive: true });
  await page.screenshot({ path: `reports/evidencias/${nombre}.png` });
}

/** Registra una medición para el informe (reports/medidas.jsonl). */
export function medir(info: TestInfo, metrica: string, valor: number, unidad: string) {
  fs.mkdirSync("reports", { recursive: true });
  fs.appendFileSync("reports/medidas.jsonl", JSON.stringify({ prueba: info.title, metrica, valor, unidad, fecha: new Date().toISOString() }) + "\n");
}

export { expect };
