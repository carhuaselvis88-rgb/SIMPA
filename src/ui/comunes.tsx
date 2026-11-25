import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { get, suscribir } from "../data/store";
import { suscribirVivo } from "../data/live";
import type { Semaforo } from "../domain/ordenes";

export function useEstado() {
  return useSyncExternalStore(suscribir, get);
}

export function useVivo() {
  const [, set] = useState(0);
  useEffect(() => suscribirVivo(() => set((x) => x + 1)), []);
}

export const nf = (n: number, d = 0) => n.toLocaleString("es-PE", { minimumFractionDigits: d, maximumFractionDigits: d });
export const fh = (ts: number) => new Date(ts).toLocaleString("es-PE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
export const hora = (ts: number) => new Date(ts).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

export function Pagina({ titulo, sub, hu, children, acciones }: { titulo: string; sub?: string; hu: string; children: ReactNode; acciones?: ReactNode }) {
  useEffect(() => { document.title = `${titulo} · SIMPA`; }, [titulo]);
  return (
    <section aria-labelledby="titulo-pagina">
      <div className="acciones" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <h1 id="titulo-pagina" tabIndex={-1}>{titulo}</h1>
        <div className="acciones"><span className="chip azul" title="Historias de usuario de esta pantalla">{hu}</span>{acciones}</div>
      </div>
      {sub && <p className="sub">{sub}</p>}
      {children}
    </section>
  );
}

export function Kpi({ valor, etiqueta, meta, estado }: { valor: string; etiqueta: string; meta?: string; estado?: "verde" | "ámbar" | "rojo" }) {
  return (
    <div className="tarjeta kpi">
      <div className="v">{valor}</div>
      <div className="l">{etiqueta}</div>
      {meta && <div className="m">{estado && <span className={`chip ${estado}`}>{estado === "verde" ? "En meta" : estado === "ámbar" ? "Atención" : "Fuera de meta"}</span>} {meta}</div>}
    </div>
  );
}

const TXT: Record<Semaforo, string> = { verde: "Verde: más de 24 h", "ámbar": "Ámbar: 8 a 24 h", rojo: "Rojo: menos de 8 h", vencida: "Vencida" };
export function ChipSemaforo({ s, horas }: { s: Semaforo; horas: number }) {
  return <span className={`chip ${s}`} title={TXT[s]} data-semaforo={s}><span aria-hidden="true">●</span> {s === "vencida" ? "Vencida" : `${nf(Math.max(0, horas), 1)} h restantes`}</span>;
}

export interface SerieGrafico { nombre: string; puntos: { x: number; y: number }[]; color: string; ancho?: number; discontinua?: boolean }

/** Gráfico de líneas SVG accesible (sin dependencias). */
export function Grafico({ series, banda, alto = 260, unidad, titulo, formatoX = hora, umbral }: { series: SerieGrafico[]; banda?: { x: number; min: number; max: number }[]; alto?: number; unidad: string; titulo: string; formatoX?: (x: number) => string; umbral?: { y: number; texto: string } }) {
  const W = 900, H = alto, m = { l: 52, r: 16, t: 26, b: 30 };
  const xs = series.flatMap((s) => s.puntos.map((p) => p.x)).concat(banda?.map((b) => b.x) ?? []);
  const ys = series.flatMap((s) => s.puntos.map((p) => p.y)).concat(banda?.flatMap((b) => [b.min, b.max]) ?? []).concat(umbral ? [umbral.y] : []);
  if (!xs.length) return <p className="sub">Sin datos para el periodo.</p>;
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys); const pad = (y1 - y0) * 0.1 || 1; y0 = Math.max(0, y0 - pad); y1 += pad;
  const sx = (x: number) => m.l + ((x - x0) / (x1 - x0 || 1)) * (W - m.l - m.r);
  const sy = (y: number) => H - m.b - ((y - y0) / (y1 - y0 || 1)) * (H - m.t - m.b);
  const ticksY = Array.from({ length: 5 }, (_, i) => y0 + (i * (y1 - y0)) / 4);
  const ticksX = Array.from({ length: 6 }, (_, i) => x0 + (i * (x1 - x0)) / 5);
  const path = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join("");
  const resumen = series.map((s) => { const v = s.puntos.map((p) => p.y); return `${s.nombre}: mín. ${nf(Math.min(...v), 1)}, máx. ${nf(Math.max(...v), 1)}, último ${nf(v[v.length - 1], 1)} ${unidad}`; }).join(". ");
  return (
    <figure className="grafico" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${titulo}. ${resumen}`}>
        {ticksY.map((t, i) => <g key={i}><line x1={m.l} x2={W - m.r} y1={sy(t)} y2={sy(t)} stroke="#e3eaef" /><text x={m.l - 6} y={sy(t) + 4} fontSize="11" textAnchor="end" fill="#4a5a66">{nf(t, 1)}</text></g>)}
        {ticksX.map((t, i) => <text key={i} x={sx(t)} y={H - 10} fontSize="11" textAnchor={i === 0 ? "start" : i === 5 ? "end" : "middle"} fill="#4a5a66">{formatoX(t)}</text>)}
        {banda && banda.length > 1 && <path d={`${path(banda.map((b) => ({ x: b.x, y: b.max })))}L${banda.slice().reverse().map((b) => `${sx(b.x).toFixed(1)},${sy(b.min).toFixed(1)}`).join("L")}Z`} fill="#1c8c8c" opacity=".14" />}
        {umbral && <g><line x1={m.l} x2={W - m.r} y1={sy(umbral.y)} y2={sy(umbral.y)} stroke="#b3261e" strokeDasharray="6 4" /><text x={W - m.r - 4} y={sy(umbral.y) - 6} fontSize="11" textAnchor="end" fill="#b3261e">{umbral.texto}</text></g>}
        {series.map((s) => <path key={s.nombre} d={path(s.puntos)} fill="none" stroke={s.color} strokeWidth={s.ancho ?? 2} strokeDasharray={s.discontinua ? "6 4" : undefined} />)}
        <text x={m.l} y={13} fontSize="11" fill="#4a5a66">{unidad}</text>
      </svg>
      <figcaption className="leyenda">{series.map((s) => <span key={s.nombre}><i style={{ background: s.color }} />{s.nombre}</span>)}{banda && <span><i style={{ background: "#1c8c8c", opacity: .3 }} />Banda esperada μ ± 3σ</span>}</figcaption>
    </figure>
  );
}

export function descargar(nombre: string, contenido: string, tipo = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["﻿" + contenido], { type: tipo }));
  const a = document.createElement("a"); a.href = url; a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Campo({ id, etiqueta, error, children }: { id: string; etiqueta: string; error?: string; children: ReactNode }) {
  return <div className="campo"><label htmlFor={id}>{etiqueta}</label>{children}{error && <div className="error" id={`${id}-error`} role="alert">{error}</div>}</div>;
}
