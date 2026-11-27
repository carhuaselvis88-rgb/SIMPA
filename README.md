# SIMPA · Sistema Inteligente de Monitoreo de Pérdidas de Agua

Prototipo funcional (PWA) del proyecto SIMPA — Taller de Proyectos 2, Universidad Continental.
Caso de estudio: SEDACUSCO S.A., sector piloto SP-01 Wanchaq Norte (datos de un gemelo digital).

## Cuentas de demostración (contraseña `Simpa2026!`)

| Cuenta | Módulos |
|---|---|
| jefe@simpa.pe | Todos |
| operador@simpa.pe | Tablero, mapa, monitoreo, alertas y órdenes |
| cuadrilla@simpa.pe | App de cuadrilla (Cuadrilla 1) |
| gerencia@simpa.pe | Tablero, balance y rendimiento |

## Comandos

```bash
npm ci
npm run dev          # http://localhost:5173
npm test             # 27 pruebas unitarias + cobertura (Vitest)
npx playwright install chromium
npm run test:e2e     # 16 pruebas de aceptación y calidad (Playwright + axe-core)
npm run build        # versión de producción en dist/
```

## Estructura

- `src/domain` — reglas de negocio puras (balance IWA, ILI, caudal nocturno, semáforo 48 h, validaciones, permisos).
- `src/data` — gemelo digital, simulador y repositorio local (se reemplaza por Supabase).
- `src/ui`, `src/pages` — 17 vistas en React.
- `tests/e2e` — pruebas de aceptación de HU01, HU02, HU04 y HU21 y pruebas de calidad.
- `reports/` — evidencias (capturas, Lighthouse, axe, mediciones).

## Publicar en Cloudflare Pages (gratis)

1. Cloudflare → Workers & Pages → Create → Pages → Connect to Git → elegir el repositorio.
3. Framework preset: **Vite** · Build command: `npm run build` · Output directory: `dist` · Variable `NODE_VERSION=22`.
4. Rama de producción: `main`; las demás ramas (p. ej. `develop`) generan vistas previas de calidad.
