import { Pagina, Kpi, useEstado, nf, fh, Grafico } from "../ui/comunes";
import { PILOTO } from "../data/gemelo";
import { serie } from "../data/live";
import { balanceIWA, perdidasRealesNocturnas, uarl, ili, categoriaILI } from "../domain/hidraulica";
import { caudalMinimoNocturno } from "../domain/alertas";
import { semaforo, horasRestantes, m3DiaRecuperados } from "../domain/ordenes";
import { irA } from "../ui/App";

const D = 24 * 3600 * 1000;

// ---------- HU22: Tablero de indicadores para gerencia ----------
export function Tablero() {
  const e = useEstado();
  const ahora = Date.now();
  const dias = 31;
  const res = balanceIWA({ ingresadoM3: PILOTO.ingresadoDia * dias, facturadoM3: e.facturado["2026-10"], autorizadoNoFacturadoM3: PILOTO.autorizadoNoFacturadoDia * dias, perdidasRealesM3: perdidasRealesNocturnas({ qmn: PILOTO.qmnBase, usoLegitimo: PILOTO.usoLegitimo, fnd: PILOTO.fnd }) * dias });
  const iliV = ili(res.realesM3 / dias, uarl({ lm: 18, nc: 2400, lp: 0, presion: 35 }));
  const cat = categoriaILI(iliV);
  const abiertas = e.ordenes.filter((o) => o.estado !== "cerrada");
  const cerradas = e.ordenes.filter((o) => o.cierre);
  const enPlazo = cerradas.filter((o) => o.cierre!.enPlazo).length;
  const pctPlazo = cerradas.length ? (enPlazo / cerradas.length) * 100 : 0;
  const vencidas = abiertas.filter((o) => semaforo(horasRestantes(new Date(o.conocida), new Date(ahora))) === "vencida").length;
  const recuperado = cerradas.reduce((s, o) => s + m3DiaRecuperados(o.cierre!.lps), 0);
  const alertasAbiertas = e.alertas.filter((a) => a.estado === "abierta").length;
  const s = serie("Q-SP01-ENT");
  const noches = Array.from({ length: 14 }, (_, i) => {
    const fin = ahora - i * D; const ini = fin - D;
    const q = caudalMinimoNocturno(s.filter((l) => l.ts > ini && l.ts <= fin).map((l) => ({ ts: new Date(l.ts), valor: l.valor })));
    return q === null ? null : { x: fin, y: q };
  }).filter(Boolean).reverse() as { x: number; y: number }[];
  return (
    <Pagina titulo="Tablero de indicadores" hu="HU22" sub="Resumen del sector piloto SP-01 (Wanchaq Norte) para la gerencia. Las cifras se recalculan con cada lectura, orden y cierre." acciones={<button className="btn sec" onClick={() => print()}>Imprimir o guardar PDF</button>}>
      <div className="rejilla c4">
        <Kpi valor={`${nf(res.anfPct, 1)} %`} etiqueta="Agua no facturada (oct. 2026)" meta="Meta: < 30 %" estado={res.anfPct < 30 ? "verde" : res.anfPct < 35 ? "ámbar" : "rojo"} />
        <Kpi valor={nf(iliV, 2)} etiqueta={`ILI · categoría ${cat.cat}`} meta={cat.texto} estado={cat.cat === "A" || cat.cat === "B" ? "verde" : cat.cat === "C" ? "ámbar" : "rojo"} />
        <Kpi valor={`${nf(pctPlazo, 0)} %`} etiqueta="Órdenes cerradas en ≤ 48 h" meta={`${enPlazo} de ${cerradas.length} · meta ≥ 90 %`} estado={pctPlazo >= 90 ? "verde" : pctPlazo >= 70 ? "ámbar" : "rojo"} />
        <Kpi valor={`${nf(recuperado, 1)} m³/día`} etiqueta="Agua recuperada por reparaciones" meta={`≈ S/ ${nf(recuperado * PILOTO.tarifa * 30)} al mes`} estado="verde" />
      </div>
      <div className="rejilla c4" style={{ marginTop: 16 }}>
        <Kpi valor={String(alertasAbiertas)} etiqueta="Alertas abiertas" estado={alertasAbiertas ? "ámbar" : "verde"} />
        <Kpi valor={String(abiertas.length)} etiqueta="Órdenes en curso" />
        <Kpi valor={String(vencidas)} etiqueta="Órdenes vencidas" estado={vencidas ? "rojo" : "verde"} />
        <Kpi valor={`S/ ${nf((res.anfM3 / dias) * PILOTO.tarifa)}`} etiqueta="Valor diario del agua no facturada" />
      </div>
      <div className="rejilla c2" style={{ marginTop: 16 }}>
        <div className="tarjeta"><Grafico titulo="Caudal mínimo nocturno, últimas 14 noches" unidad="L/s" series={[{ nombre: "Qmn", puntos: noches, color: "#0b4f6c", ancho: 2.5 }]} umbral={{ y: PILOTO.qmnBase * 1.2, texto: "Umbral +20 %" }} formatoX={(x) => new Date(x).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" })} /></div>
        <div className="tarjeta">
          <h2>Últimas acciones</h2>
          <table><tbody>{e.bitacora.slice(0, 7).map((b) => <tr key={b.id}><td>{fh(b.ts)}</td><td>{b.accion}</td><td><small>{b.detalle}</small></td></tr>)}</tbody></table>
          <div className="acciones" style={{ marginTop: 10 }}><button className="btn sec" onClick={() => irA("balance")}>Ver balance hídrico</button></div>
        </div>
      </div>
    </Pagina>
  );
}
