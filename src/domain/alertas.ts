// Detección de anomalías: caudal mínimo nocturno, presión esperada y priorización

export const UMBRAL_MNF = 0.2; // 20 % sobre la línea base

export interface ResultadoMNF {
  qmn: number;
  base: number;
  variacionPct: number;
  alerta: boolean;
}

/** Caudal mínimo nocturno entre las 02:00 y 04:00 a partir de lecturas del día. */
export function caudalMinimoNocturno(lecturas: { ts: Date; valor: number }[]): number | null {
  const noche = lecturas.filter((l) => {
    const h = l.ts.getHours() + l.ts.getMinutes() / 60;
    return h >= 2 && h < 4;
  });
  if (noche.length === 0) return null;
  return Math.min(...noche.map((l) => l.valor));
}

export function evaluarMNF(qmn: number, base: number): ResultadoMNF {
  if (base <= 0) throw new Error("línea base inválida");
  const variacionPct = ((qmn - base) / base) * 100;
  return { qmn, base, variacionPct, alerta: qmn > base * (1 + UMBRAL_MNF) };
}

/** Banda esperada μ ± 3σ de una serie de presiones. */
export function bandaEsperada(valores: number[]): { media: number; sigma: number; min: number; max: number } {
  if (valores.length < 2) throw new Error("se requieren al menos 2 valores");
  const media = valores.reduce((a, b) => a + b, 0) / valores.length;
  const sigma = Math.sqrt(valores.reduce((a, v) => a + (v - media) ** 2, 0) / (valores.length - 1));
  return { media, sigma, min: media - 3 * sigma, max: media + 3 * sigma };
}

export function fueraDeBanda(valor: number, banda: { min: number; max: number }): boolean {
  return valor < banda.min || valor > banda.max;
}

export type Prioridad = "crítica" | "alta" | "media" | "baja";
const PESO: Record<Prioridad, number> = { crítica: 4, alta: 3, media: 2, baja: 1 };

export function prioridadPorVolumen(m3Dia: number): Prioridad {
  if (m3Dia >= 200) return "crítica";
  if (m3Dia >= 100) return "alta";
  if (m3Dia >= 30) return "media";
  return "baja";
}

/** Ordena alertas por prioridad y luego por volumen estimado (mayor primero). */
export function ordenarAlertas<T extends { prioridad: Prioridad; m3Dia: number }>(a: T[]): T[] {
  return [...a].sort((x, y) => PESO[y.prioridad] - PESO[x.prioridad] || y.m3Dia - x.m3Dia);
}

/** Ranking de tramos probables según la caída de presión de los puntos cercanos. */
export function tramosProbables(
  caidas: { punto: string; caidaPct: number }[],
  vecinos: Record<string, string[]>,
  top = 3,
): { tramo: string; puntaje: number; probabilidad: number }[] {
  const score: Record<string, number> = {};
  // Los tramos vecinos vienen ordenados por cercanía al punto: el más cercano pesa 1, el segundo 1/2, el tercero 1/3.
  for (const c of caidas) (vecinos[c.punto] ?? []).forEach((t, i) => { score[t] = (score[t] ?? 0) + Math.max(0, c.caidaPct) / (i + 1); });
  const total = Object.values(score).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(score)
    .map(([tramo, puntaje]) => ({ tramo, puntaje, probabilidad: puntaje / total }))
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, top);
}

/** Prueba de pasos: tramo con la mayor caída de caudal al cerrar una válvula. */
export function resultadoPruebaPasos(pasos: { valvula: string; tramo: string; qAntes: number; qDespues: number }[]) {
  if (pasos.length === 0) throw new Error("sin pasos registrados");
  const conCaida = pasos.map((p) => ({ ...p, caida: p.qAntes - p.qDespues }));
  return conCaida.reduce((a, b) => (b.caida > a.caida ? b : a));
}
