// Gemelo digital del sector piloto SP-01 (datos simulados, reproducibles)
// Parámetros calibrados con el modelo EPANET/WNTR del informe.

export type Pos = [number, number]; // [lat, lng]

export interface Sector { id: string; codigo: string; nombre: string; anillo: Pos[]; redKm: number; conexiones: number; presionMedia: number; continuo24h: boolean; piloto: boolean }
export interface Punto { id: string; sector: string; tipo: "caudal" | "presion"; rol: "entrada" | "interno"; pos: Pos; tramos: string[] }
export interface Tramo { id: string; sector: string; material: string; diametroMm: number; anio: number; estado: string; linea: Pos[] }
export interface Valvula { id: string; sector: string; pos: Pos; tramo: string }
export interface LecturaSerie { punto: string; ts: number; valor: number; origen: "simulador" | "api" | "csv" | "manual"; emitido?: number }

// PRNG reproducible (mulberry32)
export function prng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const C: Pos = [-13.5287, -71.9655]; // Wanchaq, Cusco
const d = (dl: number, dg: number): Pos => [+(C[0] + dl).toFixed(6), +(C[1] + dg).toFixed(6)];

export const SECTORES: Sector[] = [
  { id: "SP-01", codigo: "SP-01", nombre: "Sector piloto Wanchaq Norte", anillo: [d(0.006, -0.009), d(0.006, 0.006), d(-0.004, 0.007), d(-0.005, -0.008), d(0.006, -0.009)], redKm: 18, conexiones: 2400, presionMedia: 35, continuo24h: true, piloto: true },
  { id: "SP-02", codigo: "SP-02", nombre: "Wanchaq Sur", anillo: [d(-0.005, -0.008), d(-0.004, 0.007), d(-0.013, 0.006), d(-0.013, -0.009), d(-0.005, -0.008)], redKm: 14, conexiones: 1850, presionMedia: 32, continuo24h: true, piloto: false },
  { id: "SP-03", codigo: "SP-03", nombre: "Magisterio", anillo: [d(0.006, 0.006), d(0.007, 0.018), d(-0.003, 0.019), d(-0.004, 0.007), d(0.006, 0.006)], redKm: 11, conexiones: 1320, presionMedia: 41, continuo24h: false, piloto: false },
];

const MATERIALES = ["PVC", "Asbesto-cemento", "Fierro fundido", "PEAD"];
export const TRAMOS: Tramo[] = (() => {
  const r = prng(7); const out: Tramo[] = [];
  let n = 1;
  // retícula de calles: 4 horizontales × 4 verticales dentro de SP-01
  for (let i = 0; i < 4; i++) {
    const lat = 0.0045 - i * 0.0028;
    out.push({ id: `T-${String(n).padStart(2, "0")}`, sector: "SP-01", material: MATERIALES[Math.floor(r() * 4)], diametroMm: [110, 160, 200, 250][Math.floor(r() * 4)], anio: 1975 + Math.floor(r() * 45), estado: ["bueno", "regular", "malo"][Math.floor(r() * 3)], linea: [d(lat, -0.0075), d(lat, 0.0055)] }); n++;
  }
  for (let j = 0; j < 4; j++) {
    const lng = -0.007 + j * 0.0038;
    out.push({ id: `T-${String(n).padStart(2, "0")}`, sector: "SP-01", material: MATERIALES[Math.floor(r() * 4)], diametroMm: [110, 160, 200][Math.floor(r() * 3)], anio: 1975 + Math.floor(r() * 45), estado: ["bueno", "regular", "malo"][Math.floor(r() * 3)], linea: [d(0.005, lng), d(-0.0038, lng)] }); n++;
  }
  // tramos cortos de servicio
  for (let k = 0; k < 8; k++) {
    const lat = 0.0045 - (k % 4) * 0.0028, lng = -0.007 + Math.floor(k / 4) * 0.0076 + 0.0019;
    out.push({ id: `T-${String(n).padStart(2, "0")}`, sector: "SP-01", material: MATERIALES[Math.floor(r() * 4)], diametroMm: 90, anio: 1980 + Math.floor(r() * 40), estado: ["bueno", "regular", "malo"][Math.floor(r() * 3)], linea: [d(lat, lng), d(lat - 0.0014, lng)] }); n++;
  }
  return out;
})();

export const VALVULAS: Valvula[] = [
  { id: "V-1", sector: "SP-01", pos: d(0.0045, -0.0032), tramo: "T-01" },
  { id: "V-2", sector: "SP-01", pos: d(0.0017, 0.0006), tramo: "T-02" },
  { id: "V-3", sector: "SP-01", pos: d(-0.0011, 0.0044), tramo: "T-12" },
  { id: "V-4", sector: "SP-01", pos: d(-0.0039, -0.0032), tramo: "T-04" },
];

export const PUNTOS: Punto[] = [
  { id: "Q-SP01-ENT", sector: "SP-01", tipo: "caudal", rol: "entrada", pos: d(0.0058, -0.0088), tramos: ["T-01", "T-05"] },
  { id: "P-SP01-01", sector: "SP-01", tipo: "presion", rol: "interno", pos: d(0.0045, -0.007), tramos: ["T-01", "T-05", "T-09"] },
  { id: "P-SP01-02", sector: "SP-01", tipo: "presion", rol: "interno", pos: d(0.0017, -0.0032), tramos: ["T-02", "T-06", "T-10"] },
  { id: "P-SP01-03", sector: "SP-01", tipo: "presion", rol: "interno", pos: d(-0.0011, 0.0044), tramos: ["T-12", "T-03", "T-08"] },
  { id: "P-SP01-04", sector: "SP-01", tipo: "presion", rol: "interno", pos: d(-0.0039, 0.0006), tramos: ["T-04", "T-07", "T-11"] },
  { id: "Q-SP02-ENT", sector: "SP-02", tipo: "caudal", rol: "entrada", pos: d(-0.0055, -0.0075), tramos: [] },
];

// Perfil de demanda diario (factor por hora; media = 1)
const PERFIL = [0.52, 0.45, 0.4, 0.4, 0.45, 0.72, 1.12, 1.48, 1.5, 1.32, 1.18, 1.12, 1.2, 1.18, 1.05, 0.98, 1.02, 1.15, 1.32, 1.38, 1.22, 1.0, 0.82, 0.64];
const MEDIA_PERFIL = PERFIL.reduce((a, b) => a + b, 0) / 24;

export const PILOTO = { caudalMedio: 25, qmnBase: 9.8, usoLegitimo: 1.2, fnd: 21, ingresadoDia: 2160, facturadoDia: 1311, autorizadoNoFacturadoDia: 43, tarifa: 2.5 };

/** Fuga del escenario de demostración: aparece 30 h antes de «ahora» en el tramo T-12. */
export const ESCENARIO_FUGA = { tramo: "T-12", puntoAfectado: "P-SP01-03", caudalLps: 2.7, horasAntes: 30 };

const Q15 = 15 * 60 * 1000;

/** Genera la serie de un punto entre dos instantes, cada 15 min. */
export function generarSerie(punto: Punto, desde: number, hasta: number, conFuga = true, seed = 11): LecturaSerie[] {
  const r = prng(seed + punto.id.length * 31 + punto.id.charCodeAt(punto.id.length - 1));
  const inicioFuga = hasta - ESCENARIO_FUGA.horasAntes * 3600 * 1000;
  const out: LecturaSerie[] = [];
  for (let t = Math.floor(desde / Q15) * Q15; t <= hasta; t += Q15) {
    const f = new Date(t); const h = f.getHours() + f.getMinutes() / 60;
    const fac = PERFIL[Math.floor(h)] / MEDIA_PERFIL;
    const fuga = conFuga && t >= inicioFuga;
    let v: number;
    if (punto.tipo === "caudal") {
      const base = punto.sector === "SP-01" ? PILOTO.caudalMedio : 19;
      // de madrugada el caudal se acerca al mínimo nocturno (9,8 L/s)
      v = h >= 2 && h < 4 ? PILOTO.qmnBase + r() * 0.35 : base * fac * (0.97 + r() * 0.06);
      if (fuga && punto.sector === "SP-01") v += ESCENARIO_FUGA.caudalLps;
    } else {
      const pm = 35 + (punto.id.endsWith("03") ? -1 : punto.id.endsWith("01") ? 2 : 0);
      v = pm - (fac - 1) * 3.2 + (r() - 0.5) * 0.5;
      if (fuga && punto.id === ESCENARIO_FUGA.puntoAfectado) v *= 0.7;
      else if (fuga) v *= 0.96;
    }
    out.push({ punto: punto.id, ts: t, valor: +v.toFixed(2), origen: "simulador" });
  }
  return out;
}

/** Consumos facturados de 12 meses para el análisis de submedición. */
export function consumosSuministros(n = 60): { codigo: string; sector: string; anioMedidor: number; consumos: number[] }[] {
  const r = prng(99); const out = [];
  for (let i = 0; i < n; i++) {
    const base = 8 + Math.floor(r() * 18);
    const tipo = r();
    const consumos = Array.from({ length: 12 }, (_, m) => {
      if (tipo < 0.08) return m > 4 && r() < 0.7 ? 0 : base;
      if (tipo < 0.14) return 7;
      if (tipo < 0.22) return Math.max(0, Math.round(base * (1 - m * 0.07)));
      return Math.max(0, Math.round(base + (r() - 0.5) * 5));
    });
    out.push({ codigo: `S-${String(10230 + i * 7)}`, sector: i < 40 ? "SP-01" : "SP-02", anioMedidor: 2003 + Math.floor(r() * 22), consumos });
  }
  return out;
}
