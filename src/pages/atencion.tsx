import { useState } from "react";
import { Pagina, useEstado, nf, fh, ChipSemaforo, Campo } from "../ui/comunes";
import { MapaRed } from "../ui/MapaRed";
import { actualizar, registrar, get, nuevoId, type Orden } from "../data/store";
import { VALVULAS } from "../data/gemelo";
import { ordenarAlertas, resultadoPruebaPasos } from "../domain/alertas";
import { semaforo, horasRestantes, vencimiento } from "../domain/ordenes";
import { datosReportante } from "../domain/seguridad";
import type { Sesion } from "../ui/App";

const CUADRILLAS = ["Cuadrilla 1", "Cuadrilla 2", "Cuadrilla 3"];

// ---------- HU13 · HU14: Bandeja de alertas y tramo probable ----------
export function Alertas({ sesion }: { sesion: Sesion }) {
  const e = useEstado();
  const abiertas = ordenarAlertas(e.alertas.filter((a) => a.estado === "abierta"));
  const [sel, setSel] = useState<string | null>(abiertas[0]?.id ?? null);
  const [motivo, setMotivo] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const a = e.alertas.find((x) => x.id === sel);
  const descartar = () => {
    if (!motivo.trim()) { setErr("Escriba el motivo del descarte"); return; }
    actualizar((s) => { const x = s.alertas.find((y) => y.id === sel)!; x.estado = "descartada"; x.motivo = motivo.trim(); });
    registrar(sesion.correo, "descartar alerta", `${sel}: ${motivo.trim()}`); setErr(null); setMotivo(""); setMsg(`Alerta ${sel} descartada.`); setSel(null);
  };
  const crearOrden = () => {
    if (!a) return;
    const t = a.tramos?.[0] ? get().tramos.find((x) => x.id === a.tramos![0].tramo) : undefined;
    const ahora = Date.now(); const id = nuevoId("OT", get().ordenes);
    actualizar((s) => { s.ordenes.unshift({ id, alerta: a.id, origen: "alerta", sector: a.sector, tramo: t?.id, pos: t?.linea[0] ?? [-13.5287, -71.9655], conocida: a.creada, vence: vencimiento(new Date(a.creada)).getTime(), estado: "registrada", descripcion: `${a.tipo}: ${a.detalle}${a.tramos ? ` · tramos probables ${a.tramos.map((x) => x.tramo).join(", ")}` : ""}` }); const x = s.alertas.find((y) => y.id === a.id)!; x.estado = "en orden"; });
    registrar(sesion.correo, "crear orden", `${id} desde ${a.id}`); setMsg(`Se creó la orden ${id} (vence ${fh(vencimiento(new Date(a.creada)).getTime())}).`); void ahora;
  };
  return (
    <Pagina titulo="Bandeja de alertas" hu="HU13 · HU14" sub="Alertas abiertas ordenadas por prioridad y volumen estimado. Seleccione una para ver los tramos más probables y crear la orden de trabajo.">
      <div aria-live="polite">{msg && <div className="aviso ok" role="status">{msg}</div>}</div>
      <div className="rejilla c2">
        <div className="tarjeta tabla-scroll">
          <table aria-label="Alertas abiertas"><thead><tr><th>Alerta</th><th>Tipo</th><th>Prioridad</th><th className="num">m³/día</th><th>Hora</th></tr></thead>
            <tbody>{abiertas.map((x) => <tr key={x.id} style={{ background: x.id === sel ? "var(--claro)" : undefined }}><td><button className="btn sec" style={{ minHeight: 32, padding: "4px 8px" }} onClick={() => { setSel(x.id); setErr(null); }} aria-pressed={x.id === sel}>{x.id}</button></td><td>{x.tipo}<br /><small>{x.sector}</small></td><td><span className={`chip ${x.prioridad}`}>{x.prioridad}</span></td><td className="num">{x.m3Dia ? nf(x.m3Dia) : "—"}</td><td>{fh(x.creada)}</td></tr>)}</tbody></table>
          {abiertas.length === 0 && <p className="sub">No hay alertas abiertas.</p>}
          <h3 style={{ marginTop: 14 }}>Ranking de sectores críticos</h3>
          <table aria-label="Ranking de sectores"><thead><tr><th>Sector</th><th className="num">Alertas abiertas</th><th className="num">m³/día estimados</th></tr></thead>
            <tbody>{[...new Set(e.alertas.map((x) => x.sector))].map((sc) => ({ sc, n: abiertas.filter((x) => x.sector === sc).length, m3: abiertas.filter((x) => x.sector === sc).reduce((a, b) => a + b.m3Dia, 0) })).sort((x, y) => y.m3 - x.m3 || y.n - x.n).map((r) => <tr key={r.sc}><td>{r.sc}</td><td className="num">{r.n}</td><td className="num">{nf(r.m3)}</td></tr>)}</tbody></table>
          <h3 style={{ marginTop: 14 }}>Historial</h3>
          <table><tbody>{e.alertas.filter((x) => x.estado !== "abierta").map((x) => <tr key={x.id}><td>{x.id}</td><td>{x.tipo}</td><td>{x.estado}{x.motivo ? `: ${x.motivo}` : ""}</td></tr>)}</tbody></table>
        </div>
        <div className="tarjeta">
          {!a ? <p className="sub">Seleccione una alerta.</p> : <>
            <h2>{a.id} · {a.tipo}</h2>
            <p>{a.detalle}</p>
            {a.tramos && <><h3>Tramos más probables (HU14)</h3><ol>{a.tramos.map((t) => <li key={t.tramo}><b>{t.tramo}</b>: probabilidad relativa {nf(t.probabilidad * 100)} %</li>)}</ol>
              <MapaRed bajo sectores={e.sectores.filter((s) => s.id === a.sector)} tramos={e.tramos} capas={{ sectores: true, tuberias: true, puntos: true, valvulas: false, hallazgos: false, alertas: false }} resaltar={a.tramos.map((t) => t.tramo)} /></>}
            {a.estado === "abierta" && sesion.rol !== "gerencia" && <>
              <div className="acciones" style={{ marginTop: 12 }}><button className="btn" onClick={crearOrden}>Crear orden de trabajo</button></div>
              <Campo id="motivo" etiqueta="Motivo del descarte" error={err ?? undefined}><input id="motivo" value={motivo} aria-invalid={!!err} onChange={(ev) => setMotivo(ev.target.value)} placeholder="Ej.: mantenimiento programado" /></Campo>
              <button className="btn sec" onClick={descartar}>Descartar alerta</button></>}
          </>}
        </div>
      </div>
    </Pagina>
  );
}

// ---------- HU15: Prueba de pasos ----------
export function PruebaPasos({ sesion }: { sesion: Sesion }) {
  const e = useEstado();
  const prueba = e.pruebas.find((p) => p.estado !== "finalizada") ?? e.pruebas[0];
  const [orden, setOrden] = useState<string[]>(VALVULAS.map((v) => v.id));
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const planificar = () => { const id = nuevoId("PP", get().pruebas); actualizar((s) => { s.pruebas.unshift({ id, sector: "SP-01", orden, pasos: [], estado: "en curso" }); }); registrar(sesion.correo, "planificar prueba de pasos", `${id}: ${orden.join(" → ")}`); };
  const mover = (i: number, d: number) => { const o = [...orden]; const j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; setOrden(o); };
  const siguiente = prueba && prueba.estado === "en curso" ? prueba.orden[prueba.pasos.length] : undefined;
  const registrarPaso = () => {
    const v = Number(q.replace(",", "."));
    if (!(v >= 0)) { setErr("Ingrese el caudal medido después del cierre (L/s)"); return; }
    const qAntes = prueba!.pasos.length ? prueba!.pasos[prueba!.pasos.length - 1].qDespues : 25.0;
    const tramo = VALVULAS.find((x) => x.id === siguiente)!.tramo;
    actualizar((s) => { const p = s.pruebas.find((x) => x.id === prueba!.id)!; p.pasos.push({ valvula: siguiente!, tramo, qAntes, qDespues: v, ts: Date.now() }); if (p.pasos.length === p.orden.length) p.estado = "finalizada"; });
    setQ(""); setErr(null);
  };
  const resultado = prueba && prueba.pasos.length ? resultadoPruebaPasos(prueba.pasos) : null;
  return (
    <Pagina titulo="Prueba de pasos" hu="HU15" sub="Cierre secuencial de válvulas del sector: el tramo cuyo cierre produce la mayor caída del caudal de ingreso es donde está la fuga.">
      <div className="rejilla c2">
        <div className="tarjeta">
          <h2>1. Orden de cierre</h2>
          <ol className="pasos">{orden.map((v, i) => <li key={v}><b>{v}</b> (tramo {VALVULAS.find((x) => x.id === v)!.tramo}) <button className="btn sec" style={{ minHeight: 30, padding: "2px 8px" }} onClick={() => mover(i, -1)} aria-label={`Subir ${v}`}>↑</button> <button className="btn sec" style={{ minHeight: 30, padding: "2px 8px" }} onClick={() => mover(i, 1)} aria-label={`Bajar ${v}`}>↓</button></li>)}</ol>
          <button className="btn" onClick={planificar} disabled={!!prueba && prueba.estado === "en curso"}>Guardar secuencia e iniciar</button>
        </div>
        <div className="tarjeta" aria-live="polite">
          <h2>2. Registro de pasos {prueba ? `(${prueba.id})` : ""}</h2>
          {!prueba ? <p className="sub">Guarde una secuencia para iniciar la prueba.</p> : <>
            <table><thead><tr><th>Válvula</th><th>Tramo</th><th className="num">Q antes</th><th className="num">Q después</th><th className="num">Caída</th></tr></thead><tbody>{prueba.pasos.map((p) => <tr key={p.valvula}><td>{p.valvula}</td><td>{p.tramo}</td><td className="num">{nf(p.qAntes, 2)}</td><td className="num">{nf(p.qDespues, 2)}</td><td className="num">{nf(p.qAntes - p.qDespues, 2)}</td></tr>)}</tbody></table>
            {siguiente && <div style={{ marginTop: 12 }}><Campo id="qpaso" etiqueta={`Caudal de ingreso tras cerrar ${siguiente} (L/s)`} error={err ?? undefined}><input id="qpaso" inputMode="decimal" value={q} aria-invalid={!!err} onChange={(ev) => setQ(ev.target.value)} /></Campo><button className="btn" onClick={registrarPaso}>Registrar paso</button></div>}
            {resultado && prueba.estado === "finalizada" && <div className="aviso ok" role="status"><b>Informe:</b> la mayor caída ({nf(resultado.caida, 2)} L/s) ocurrió al cerrar {resultado.valvula}. La fuga está en el tramo <b>{resultado.tramo}</b>.</div>}
          </>}
        </div>
      </div>
    </Pagina>
  );
}

// ---------- HU16 · HU17: Órdenes de trabajo (Kanban + semáforo) ----------
export function Ordenes({ sesion }: { sesion: Sesion }) {
  const e = useEstado();
  const ahora = Date.now();
  const [filtro, setFiltro] = useState<"todas" | "vencidas">("todas");
  const [nueva, setNueva] = useState(false);
  const [f, setF] = useState({ origen: "ciudadano", descripcion: "", direccion: "", nombre: "", telefono: "", consentimiento: false });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const cols: Orden["estado"][] = ["registrada", "asignada", "en atención", "cerrada"];
  const lista = e.ordenes.filter((o) => filtro === "todas" || (o.estado !== "cerrada" && semaforo(horasRestantes(new Date(o.conocida), new Date(ahora))) === "vencida"));
  const asignar = (o: Orden, c: string) => { const antes = o.cuadrilla; actualizar((s) => { const x = s.ordenes.find((y) => y.id === o.id)!; x.cuadrilla = c; if (x.estado === "registrada") x.estado = "asignada"; }); registrar(sesion.correo, antes ? "reasignar orden" : "asignar orden", `${o.id}: ${antes ? antes + " → " : ""}${c}`); setMsg(`${o.id} asignada a ${c}. La cuadrilla la verá en su app.`); };
  const crear = (ev: React.FormEvent) => {
    ev.preventDefault();
    const er: Record<string, string> = {};
    if (!f.descripcion.trim()) er.descripcion = "Describa la fuga";
    if (!f.direccion.trim()) er.direccion = "Indique la ubicación";
    if (f.origen === "ciudadano" && f.nombre && !f.consentimiento) er.consentimiento = "Se requiere el consentimiento para guardar los datos del reportante (Ley N.° 29733)";
    setErrs(er); if (Object.keys(er).length) return;
    const id = nuevoId("OT", get().ordenes);
    actualizar((s) => { s.ordenes.unshift({ id, origen: f.origen as Orden["origen"], sector: "SP-01", pos: [-13.5287, -71.9655], conocida: ahora, vence: vencimiento(new Date(ahora)).getTime(), estado: "registrada", reportante: f.nombre ? { nombre: f.nombre, telefono: f.telefono, consentimiento: f.consentimiento } : undefined, descripcion: `${f.descripcion} (${f.direccion})` }); });
    registrar(sesion.correo, "crear orden", `${id} origen ${f.origen}`);
    setMsg(`Orden ${id} registrada. Vence el ${fh(vencimiento(new Date(ahora)).getTime())}.`); setNueva(false); setF({ origen: "ciudadano", descripcion: "", direccion: "", nombre: "", telefono: "", consentimiento: false });
  };
  return (
    <Pagina titulo="Órdenes de trabajo" hu="HU16 · HU17" sub="Cada reporte o alerta genera una orden con plazo de 48 h desde que se conoce la fuga. Semáforo por horas restantes: verde más de 24 h, ámbar de 8 a 24 h, rojo menos de 8 h."
      acciones={<><button className="btn" onClick={() => setNueva(!nueva)} aria-expanded={nueva}>Nueva orden</button><label htmlFor="filtro" className="sr">Filtro</label><select id="filtro" style={{ width: "auto" }} value={filtro} onChange={(ev) => setFiltro(ev.target.value as "todas" | "vencidas")}><option value="todas">Todas</option><option value="vencidas">Solo vencidas</option></select></>}>
      <div aria-live="polite">{msg && <div className="aviso ok" role="status">{msg}</div>}</div>
      {nueva && <form className="tarjeta" style={{ marginBottom: 16 }} onSubmit={crear} noValidate aria-label="Nueva orden">
        <div className="rejilla c3" style={{ gap: 12 }}>
          <Campo id="o-origen" etiqueta="Origen"><select id="o-origen" value={f.origen} onChange={(ev) => setF({ ...f, origen: ev.target.value })}><option value="ciudadano">Reporte ciudadano</option><option value="contratista">Contratista</option></select></Campo>
          <Campo id="o-desc" etiqueta="Descripción" error={errs.descripcion}><input id="o-desc" value={f.descripcion} aria-invalid={!!errs.descripcion} onChange={(ev) => setF({ ...f, descripcion: ev.target.value })} /></Campo>
          <Campo id="o-dir" etiqueta="Dirección o referencia" error={errs.direccion}><input id="o-dir" value={f.direccion} aria-invalid={!!errs.direccion} onChange={(ev) => setF({ ...f, direccion: ev.target.value })} /></Campo>
          <Campo id="o-nom" etiqueta="Nombre del reportante (opcional)"><input id="o-nom" value={f.nombre} onChange={(ev) => setF({ ...f, nombre: ev.target.value })} /></Campo>
          <Campo id="o-tel" etiqueta="Teléfono (opcional)"><input id="o-tel" inputMode="tel" value={f.telefono} onChange={(ev) => setF({ ...f, telefono: ev.target.value })} /></Campo>
          <div className="campo"><label style={{ display: "flex", gap: 8, fontWeight: "normal" }}><input type="checkbox" style={{ width: 20, minHeight: 20 }} checked={f.consentimiento} onChange={(ev) => setF({ ...f, consentimiento: ev.target.checked })} />El reportante autoriza el uso de sus datos para atender el reporte</label>{errs.consentimiento && <div className="error" role="alert">{errs.consentimiento}</div>}</div>
        </div>
        <button className="btn" type="submit">Registrar orden</button>
      </form>}
      <div className="kanban">
        {cols.map((c) => { const items = lista.filter((o) => o.estado === c); return (
          <section className="columna" key={c} aria-label={`Columna ${c}`}>
            <h3><span style={{ textTransform: "capitalize" }}>{c}</span><span className="chip gris">{items.length}</span></h3>
            {items.map((o) => { const h = horasRestantes(new Date(o.conocida), new Date(ahora)); const s = o.estado === "cerrada" ? null : semaforo(h); const rep = datosReportante(sesion.rol, o.reportante ?? null); return (
              <article key={o.id} className={`ot ${s ?? ""}`} data-orden={o.id}>
                <div className="acciones" style={{ justifyContent: "space-between" }}><b>{o.id}</b>{s ? <ChipSemaforo s={s} horas={h} /> : <span className={`chip ${o.cierre?.enPlazo ? "verde" : "rojo"}`}>{o.cierre?.enPlazo ? "En plazo" : "Fuera de plazo"}</span>}</div>
                <div style={{ margin: "6px 0" }}>{o.descripcion}</div>
                <small>Origen: {o.origen} · conocida {fh(o.conocida)} · vence {fh(o.vence)}</small>
                {rep && <div><small>Reportante: {rep.nombre} · {rep.telefono}</small></div>}
                {o.estado !== "cerrada" && sesion.rol !== "gerencia" && <div style={{ marginTop: 8 }}><label htmlFor={`asig-${o.id}`} className="sr">Cuadrilla de {o.id}</label><select id={`asig-${o.id}`} value={o.cuadrilla ?? ""} onChange={(ev) => ev.target.value && asignar(o, ev.target.value)}><option value="">— Asignar cuadrilla —</option>{CUADRILLAS.map((q) => <option key={q}>{q}</option>)}</select></div>}
                {o.cierre && <small>Cerrada {fh(o.cierre.ts)} · {o.cierre.tipo}{o.cierre.materiales ? ` (${o.cierre.materiales})` : ""} · {nf(o.cierre.lps, 1)} L/s recuperados</small>}
              </article>); })}
          </section>); })}
      </div>
    </Pagina>
  );
}
