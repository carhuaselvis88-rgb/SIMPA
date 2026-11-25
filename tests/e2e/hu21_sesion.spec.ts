import { test } from "@playwright/test";
import { entrar, evidencia, expect } from "./ayuda";

test.describe("HU21 · Iniciar sesión según el rol", () => {
  test("HU21-E01 Acceso según el rol del operador", async ({ page }) => {
    await entrar(page, "operador@simpa.pe");
    await expect(page.getByRole("heading", { name: "Tablero de indicadores" })).toBeVisible();
    const menu = page.getByRole("navigation");
    for (const m of ["Telemetría", "Alertas", "Órdenes de trabajo"]) await expect(menu.getByRole("link", { name: m })).toBeVisible();
    for (const m of ["Usuarios y bitácora", "Sectores y puntos", "Operación y respaldo", "App de cuadrilla"]) await expect(menu.getByRole("link", { name: m })).toHaveCount(0);
    await evidencia(page, "HU21-E01");
  });

  test("HU21-E02 Cinco intentos fallidos bloquean el acceso 15 minutos", async ({ page }) => {
    for (let i = 1; i <= 5; i++) {
      await entrar(page, "operador@simpa.pe", "ClaveMala" + i);
      await expect(page.getByRole("alert").or(page.getByRole("status")).first()).toContainText(i < 5 ? "Correo o contraseña incorrectos" : "bloqueado");
    }
    await entrar(page, "operador@simpa.pe");
    await expect(page.getByText(/bloqueado temporalmente/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tablero de indicadores" })).toHaveCount(0);
    await evidencia(page, "HU21-E02");
  });

  test("HU21-E03 Cuadrilla intenta abrir la gestión de usuarios", async ({ page }) => {
    await entrar(page, "cuadrilla@simpa.pe");
    await expect(page.getByRole("heading", { name: "App de cuadrilla" })).toBeVisible();
    await page.goto("/#/usuarios");
    await expect(page.getByRole("heading", { name: "Acceso denegado" })).toBeVisible();
    await evidencia(page, "HU21-E03");
  });

  test("HU21-E04 La cuadrilla solo ve las órdenes de su cuadrilla", async ({ page }) => {
    await entrar(page, "cuadrilla@simpa.pe");
    await expect(page.getByRole("heading", { name: "App de cuadrilla" })).toBeVisible();
    await expect(page.getByText("OT-0140")).toBeVisible();
    await expect(page.getByText("OT-0141")).toHaveCount(0);
    await expect(page.getByText("OT-0142")).toHaveCount(0);
    await evidencia(page, "HU21-E04");
  });
});
