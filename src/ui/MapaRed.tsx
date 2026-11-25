import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PUNTOS, VALVULAS, type Tramo, type Sector, type Pos } from "../data/gemelo";
import { ultima } from "../data/live";
import type { Alerta, Hallazgo } from "../data/store";

export interface Capas { sectores: boolean; tuberias: boolean; puntos: boolean; valvulas: boolean; hallazgos: boolean; alertas: boolean }
const COLOR_ANIO = (a: number) => (a < 1985 ? "#b3261e" : a < 2000 ? "#c98a00" : a < 2010 ? "#1c8c8c" : "#1e7d32");

export function MapaRed({ sectores, tramos, capas, hallazgos = [], alertas = [], porAntiguedad = false, resaltar = [], onTramo, onPunto, bajo, marcador }: {
  sectores: Sector[]; tramos: Tramo[]; capas: Capas; hallazgos?: Hallazgo[]; alertas?: Alerta[]; porAntiguedad?: boolean; resaltar?: string[];
  onTramo?: (id: string) => void; onPunto?: (id: string) => void; bajo?: boolean; marcador?: Pos;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const grupo = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!ref.current || mapa.current) return;
    const m = L.map(ref.current, { zoomControl: true, attributionControl: true }).setView([-13.5287, -71.9655], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
    mapa.current = m; grupo.current = L.layerGroup().addTo(m);
    return () => { m.remove(); mapa.current = null; };
  }, []);

  useEffect(() => {
    const g = grupo.current; if (!g) return;
    g.clearLayers();
    if (capas.sectores) for (const s of sectores) L.polygon(s.anillo, { color: s.piloto ? "#0b4f6c" : "#4a5a66", weight: 2, fillOpacity: s.piloto ? 0.08 : 0.04, dashArray: s.piloto ? undefined : "5 4", className: `sector sector-${s.codigo}` }).bindTooltip(`${s.codigo} · ${s.nombre}`).addTo(g);
    if (capas.tuberias) for (const t of tramos) {
      const resal = resaltar.includes(t.id);
      const color = resal ? "#b3261e" : porAntiguedad ? COLOR_ANIO(t.anio) : "#1c8c8c";
      const linea = L.polyline(t.linea, { color, weight: resal ? 7 : t.diametroMm >= 160 ? 5 : 3, opacity: 0.9, className: `tramo tramo-${t.id}` });
      linea.bindTooltip(`${t.id} · ${t.material} Ø${t.diametroMm} mm · ${t.anio}${resal ? " · tramo probable" : ""}`);
      if (onTramo) linea.on("click", () => onTramo(t.id));
      linea.addTo(g);
    }
    if (capas.valvulas) for (const v of VALVULAS) L.circleMarker(v.pos, { radius: 6, color: "#222", fillColor: "#fff", fillOpacity: 1, weight: 2, className: "valvula" }).bindTooltip(`Válvula ${v.id}`).addTo(g);
    if (capas.puntos) for (const p of PUNTOS.filter((x) => sectores.some((s) => s.id === x.sector))) {
      const u = ultima(p.id);
      const sinDatos = !u || Date.now() - u.ts > 3600 * 1000;
      const mk = L.circleMarker(p.pos, { radius: 9, color: "#fff", weight: 2, fillColor: sinDatos ? "#888" : p.tipo === "caudal" ? "#0b4f6c" : "#7a4f9e", fillOpacity: 1, className: `punto punto-${p.id}` });
      mk.bindPopup(`<b>${p.id}</b><br>${p.tipo === "caudal" ? "Caudal" : "Presión"}: ${u ? u.valor.toLocaleString("es-PE") + (p.tipo === "caudal" ? " L/s" : " m") : "—"}<br>${u ? new Date(u.ts).toLocaleTimeString("es-PE") : ""}<br>Estado: ${sinDatos ? "sin datos" : "normal"}`);
      if (onPunto) mk.on("click", () => onPunto(p.id));
      mk.addTo(g);
    }
    if (capas.hallazgos) for (const h of hallazgos) L.marker(h.pos, { icon: L.divIcon({ className: "", html: `<div style="background:${h.metodo === "acústico" ? "#0b4f6c" : h.metodo === "térmico" ? "#b3261e" : "#1e7d32"};color:#fff;border-radius:6px;padding:2px 5px;font:bold 11px Arial">${h.metodo === "acústico" ? "🎧" : h.metodo === "térmico" ? "🌡" : "👁"} ${h.orden}</div>` }) }).bindTooltip(`Hallazgo ${h.metodo}: ${h.tipo}`).addTo(g);
    if (capas.alertas) for (const a of alertas.filter((x) => x.estado === "abierta" && x.tramos?.length)) {
      const t = tramos.find((x) => x.id === a.tramos![0].tramo);
      if (t) L.marker(t.linea[0], { icon: L.divIcon({ className: "", html: `<div style="background:#b3261e;color:#fff;border-radius:50%;width:24px;height:24px;display:grid;place-items:center;font:bold 14px Arial" aria-label="alerta">!</div>` }) }).bindTooltip(`${a.id}: ${a.tipo}`).addTo(g);
    }
    if (marcador) L.circleMarker(marcador, { radius: 11, color: "#b3261e", weight: 3, fillOpacity: 0.2 }).addTo(g);
  }, [sectores, tramos, capas, hallazgos, alertas, porAntiguedad, resaltar, onTramo, onPunto, marcador]);

  return <div ref={ref} className={`mapa${bajo ? " bajo" : ""}`} role="region" aria-label="Mapa de la red de distribución" />;
}
