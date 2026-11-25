// Validaciones de datos de entrada: lecturas, CSV, GeoJSON, catastro, hallazgos

export interface Lectura {
  punto: string;
  ts: string; // ISO
  valor: number;
  tipo: "caudal" | "presion";
}

export function validarLectura(l: Partial<Lectura>): string[] {
  const e: string[] = [];
  if (!l.punto) e.push("punto requerido");
  if (!l.ts || Number.isNaN(Date.parse(l.ts))) e.push("marca de tiempo inválida");
  if (typeof l.valor !== "number" || Number.isNaN(l.valor)) e.push("valor numérico requerido");
  else if (l.valor < 0) e.push(l.tipo === "presion" ? "presión negativa" : "valor negativo");
  else if (l.tipo === "presion" && l.valor > 150) e.push("presión fuera de rango (> 150 m)");
  else if (l.tipo === "caudal" && l.valor > 500) e.push("caudal fuera de rango (> 500 L/s)");
  return e;
}

export interface FilaCSV { fila: number; lectura?: Lectura; error?: string }

/** Analiza un CSV con cabecera: punto,fecha_hora,valor,tipo */
export function parsearCSV(texto: string): { validas: Lectura[]; errores: FilaCSV[] } {
  const lineas = texto.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lineas.length === 0) return { validas: [], errores: [{ fila: 0, error: "archivo vacío" }] };
  const cab = lineas[0].split(",").map((c) => c.trim().toLowerCase());
  const esperado = ["punto", "fecha_hora", "valor", "tipo"];
  if (esperado.some((c, i) => cab[i] !== c)) return { validas: [], errores: [{ fila: 1, error: "cabecera inválida: use punto,fecha_hora,valor,tipo" }] };
  const validas: Lectura[] = [];
  const errores: FilaCSV[] = [];
  lineas.slice(1).forEach((l, i) => {
    const [punto, ts, valor, tipo] = l.split(",").map((c) => c.trim());
    const lec = { punto, ts, valor: Number(valor.replace?.(",", ".") ?? valor), tipo: tipo as Lectura["tipo"] };
    const errs = validarLectura(lec);
    if (tipo !== "caudal" && tipo !== "presion") errs.push("tipo debe ser caudal o presion");
    if (errs.length) errores.push({ fila: i + 2, error: errs.join("; ") });
    else validas.push(lec);
  });
  return { validas, errores };
}

/** Clave única de una lectura (punto + hora) para evitar duplicados. */
export const claveLectura = (l: Pick<Lectura, "punto" | "ts">) => `${l.punto}|${new Date(l.ts).toISOString()}`;

// ---------- GeoJSON ----------
type Pos = [number, number];
function segmentosSeCruzan(a: Pos, b: Pos, c: Pos, d: Pos): boolean {
  const o = (p: Pos, q: Pos, r: Pos) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

export function poligonoValido(anillo: Pos[]): string | null {
  if (anillo.length < 4) return "el polígono necesita al menos 4 posiciones";
  const [f, l] = [anillo[0], anillo[anillo.length - 1]];
  if (f[0] !== l[0] || f[1] !== l[1]) return "el polígono no está cerrado";
  const n = anillo.length - 1;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      if (segmentosSeCruzan(anillo[i], anillo[i + 1], anillo[j], anillo[j + 1])) return "el polígono se cruza a sí mismo";
    }
  return null;
}

export interface SectorImportado { codigo: string; nombre: string; anillo: Pos[] }

/** Valida un FeatureCollection de sectores; todo o nada. */
export function importarSectores(geojson: unknown): { ok: true; sectores: SectorImportado[] } | { ok: false; fila: number; motivo: string } {
  const g = geojson as { type?: string; features?: { properties?: Record<string, string>; geometry?: { type?: string; coordinates?: Pos[][] } }[] };
  if (!g || g.type !== "FeatureCollection" || !Array.isArray(g.features)) return { ok: false, fila: 0, motivo: "no es un FeatureCollection" };
  const out: SectorImportado[] = [];
  for (let i = 0; i < g.features.length; i++) {
    const f = g.features[i];
    const fila = i + 1;
    if (f.geometry?.type !== "Polygon" || !f.geometry.coordinates?.[0]) return { ok: false, fila, motivo: "la geometría debe ser Polygon" };
    if (!f.properties?.codigo || !f.properties?.nombre) return { ok: false, fila, motivo: "faltan las propiedades codigo y nombre" };
    const err = poligonoValido(f.geometry.coordinates[0]);
    if (err) return { ok: false, fila, motivo: err };
    out.push({ codigo: f.properties.codigo, nombre: f.properties.nombre, anillo: f.geometry.coordinates[0] });
  }
  return { ok: true, sectores: out };
}

// ---------- Catastro ----------
export function validarTramo(t: { material: string; diametroMm: number; anio: number }, anioActual = new Date().getFullYear()): Record<string, string> {
  const e: Record<string, string> = {};
  if (!t.material) e.material = "Seleccione el material";
  if (!(t.diametroMm >= 50 && t.diametroMm <= 1200)) e.diametroMm = "El diámetro debe estar entre 50 y 1 200 mm";
  if (!(t.anio >= 1900 && t.anio <= anioActual)) e.anio = `El año debe estar entre 1900 y ${anioActual}`;
  return e;
}

// ---------- Hallazgos ----------
export function validarHallazgo(h: { metodo: string; tipo: string; lat: number | null; lng: number | null; fotos: number }): string[] {
  const e: string[] = [];
  if (!["acústico", "térmico", "visual"].includes(h.metodo)) e.push("Seleccione el método de detección");
  if (!h.tipo) e.push("Indique el tipo de fuga");
  if (h.lat === null || h.lng === null) e.push("Registre la ubicación GPS");
  if (h.fotos < 1) e.push("Agregue al menos una foto");
  return e;
}

// ---------- Submedición ----------
export function puntajeSubmedicion(consumos: number[], anioMedidor: number, anioActual = new Date().getFullYear()): { puntaje: number; motivos: string[] } {
  const motivos: string[] = [];
  let p = 0;
  const ceros = consumos.filter((c) => c === 0).length;
  if (ceros >= 3) { p += 40; motivos.push(`${ceros} meses con consumo cero`); }
  const max = Math.max(...consumos), min = Math.min(...consumos);
  if (consumos.length >= 6 && max - min <= 1 && max > 0) { p += 25; motivos.push("consumo plano"); }
  const prim = consumos.slice(0, 6).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(6, consumos.length));
  const ult = consumos.slice(-6).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(6, consumos.length));
  if (prim > 0 && ult < prim * 0.6) { p += 25; motivos.push("consumo en caída (> 40 %)"); }
  if (anioActual - anioMedidor >= 10) { p += 10; motivos.push(`medidor de ${anioActual - anioMedidor} años`); }
  return { puntaje: Math.min(100, p), motivos };
}
