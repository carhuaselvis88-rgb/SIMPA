// Telemetría en vivo (modo demostración): el simulador del gemelo digital
// emite una lectura por punto cada 4 s y se mide la latencia hasta la pantalla.
import { PUNTOS, generarSerie, type LecturaSerie } from "./gemelo";
import { get } from "./store";

const H = 3600 * 1000;
const series = new Map<string, LecturaSerie[]>();
const listeners = new Set<() => void>();
export const latencias: number[] = [];
let timer: number | undefined;
let pausado = false;

export function iniciarSeries() {
  if (series.size) return;
  const ahora = Date.now();
  for (const p of PUNTOS) series.set(p.id, generarSerie(p, ahora - 14 * 24 * H, ahora));
  for (const l of get().lecturasExtra) agregar(l, false);
}

export function serie(punto: string): LecturaSerie[] { iniciarSeries(); return series.get(punto) ?? []; }
export function ultima(punto: string): LecturaSerie | undefined { const s = serie(punto); return s[s.length - 1]; }

export function agregar(l: LecturaSerie, notificar = true) {
  const s = series.get(l.punto) ?? [];
  s.push(l); s.sort((a, b) => a.ts - b.ts);
  series.set(l.punto, s);
  if (notificar) listeners.forEach((f) => f());
}

export function existe(punto: string, ts: number) { return serie(punto).some((l) => l.ts === ts); }

export function suscribirVivo(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }

/** Emite lecturas del simulador; cada lectura guarda el instante de emisión para medir la latencia. */
export function arrancarSimulador() {
  iniciarSeries();
  if (timer) return;
  timer = window.setInterval(() => {
    if (pausado) return;
    const ahora = Date.now();
    for (const p of PUNTOS.filter((x) => x.sector === "SP-01")) {
      const ult = ultima(p.id);
      const ruido = (Math.random() - 0.5) * (p.tipo === "caudal" ? 0.8 : 0.3);
      const valor = +(((ult?.valor ?? 25) * 0.9 + (p.tipo === "caudal" ? 25 : 34) * 0.1) + ruido).toFixed(2);
      const l = { punto: p.id, ts: ahora, valor, origen: "simulador" as const, emitido: performance.now() };
      agregar(l);
    }
  }, 4000);
}

export function pausarSimulador(v: boolean) { pausado = v; }
export function simuladorPausado() { return pausado; }

/** Registra la latencia de una lectura al pintarse en pantalla. */
export function registrarLatencia(ms: number) { latencias.push(ms); if (latencias.length > 500) latencias.shift(); }

export function percentil(v: number[], p: number) {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}
