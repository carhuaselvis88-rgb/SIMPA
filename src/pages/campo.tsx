import { useEffect, useState } from "react";
import { Pagina, useEstado, nf, fh, ChipSemaforo, Campo as CampoF } from "../ui/comunes";
import { actualizar, registrar, get, nuevoId, type Orden } from "../data/store";
import { agregar } from "../data/live";
import { PUNTOS } from "../data/gemelo";
import { MapaRed } from "../ui/MapaRed";
import { semaforo, horasRestantes, validarCierre, dentroDePlazo, m3DiaRecuperados } from "../domain/ordenes";
import { validarHallazgo, validarLectura } from "../domain/validaciones";
import { datosReportante } from "../domain/seguridad";
import type { Sesion } from "../ui/App";

// ---------- HU07 · HU18 · HU19 · HU20: App de cuadrilla (PWA) ----------
export function Campo({ sesion }: { sesion: Sesion }) {
  const e = useEstado();
  const [sinSenal, setSinSenal] = useState(!navigator.onLine);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [vista, setVista] = useState<"ordenes" | "lectura">("ordenes");
  const mias = e.ordenes.filter((o) => o.estado !== "cerrada" && (sesion.rol !== "cuadrilla" || o.cuadrilla === sesion.cuadrilla));
  useEffect(() => { const on = () => setSinSenal(false), off = () => setSinSenal(true); addEventListener("online", on); addEventListener("offline", off); return () => { removeEventListener("online", on); removeEventListener("offline", off); }; }, []);
  const sincronizar = () => {
    const cola = get().cola;
    actualizar((s) => { for (const c of s.cola) { if (c.tipo === "hallazgo") { const h = s.hallazgos.find((x) => x.id === (c.payload as { id: string }).id); if (h) h.sincronizado = true; } } s.cola = []; });
    registrar(sesion.correo, "sincronizar", `${cola.length} registros enviados`);
  };
  useEffect(() => { if (!sinSenal && get().cola.length) sincronizar(); }, [sinSenal]); // eslint-disable-line
  const orden = e.ordenes.find((o) => o.id === abierta);
  return (
    <Pagina titulo="App de cuadrilla" hu="HU07 · HU18 · HU19 · HU20" sub="Diseñada para el celular: botones grandes, alto contraste y funcionamiento sin señal. Instálela desde el menú del navegador (Agregar a pantalla de inicio).">
      <div className="campo-app">
        <div className="tarjeta" style={{ marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: "normal" }}><input type="checkbox" style={{ width: 24, minHeight: 24 }} checked={sinSenal} onChange={(ev) => setSinSenal(ev.target.checked)} />Simular trabajo sin señal</label>
          {sinSenal && <div className="offline" role="status" style={{ marginTop: 8 }}>Sin conexión: sus registros se guardan en el celular y se enviarán al recuperar la señal.</div>}
        </div>
        <div className="acciones" style={{ marginBottom: 12 }} role="tablist">
          <button role="tab" aria-selected={vista === "ordenes"} className={`btn ${vista === "ordenes" ? "" : "sec"}`} style={{ flex: 1, width: "auto" }} onClick={() => { setVista("ordenes"); setAbierta(null); }}>Mis órdenes ({mias.length})</button>
          <button role="tab" aria-selected={vista === "lectura"} className={`btn ${vista === "lectura" ? "" : "sec"}`} style={{ flex: 1, width: "auto" }} onClick={() => setVista("lectura")}>Lectura manual</button>
        </div>
        {vista === "lectura" ? <LecturaManual sesion={sesion} sinSenal={sinSenal} /> : !orden ? (
          mias.length === 0 ? <p className="sub">No tiene órdenes asignadas.</p> : mias.map((o) => { const h = horasRestantes(new Date(o.conocida), new Date()); return (
            <article className={`ot ${semaforo(h)}`} key={o.id}>
              <div className="acciones" style={{ justifyContent: "space-between" }}><b>{o.id}</b><ChipSemaforo s={semaforo(h)} horas={h} /></div>
              <p style={{ margin: "8px 0" }}>{o.descripcion}</p>
              <button className="btn" onClick={() => setAbierta(o.id)}>Abrir orden</button>
            </article>); })
        ) : <DetalleOrden o={orden} sesion={sesion} sinSenal={sinSenal} volver={() => setAbierta(null)} />}
        {e.cola.length > 0 && <div className="cola" role="status"><b>{e.cola.length}</b> registro(s) pendientes de enviar {sinSenal ? "· se enviarán al recuperar la señal" : <button className="btn" style={{ marginTop: 8 }} onClick={sincronizar}>Sincronizar ahora</button>}</div>}
      </div>
    </Pagina>
  );
}

function DetalleOrden({ o, sesion, sinSenal, volver }: { o: Orden; sesion: Sesion; sinSenal: boolean; volver: () => void }) {
  const e = useEstado();
  const [paso, setPaso] = useState<"detalle" | "hallazgo" | "cierre">("detalle");
  const [h, setH] = useState({ metodo: "", tipo: "", lat: null as number | null, lng: null as number | null, precision: 0, fotos: [] as string[] });
  const [c, setC] = useState({ tipo: "", lps: "", foto: null as string | null, materiales: "" });
  const [errs, setErrs] = useState<string[]>([]);
  const [ok, setOk] = useState<string | null>(null);
  const rep = datosReportante(sesion.rol, o.reportante ?? null);
  const gps = () => {
    if (!navigator.geolocation) { setH({ ...h, lat: o.pos[0], lng: o.pos[1], precision: 15 }); return; }
    navigator.geolocation.getCurrentPosition((p) => setH({ ...h, lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), precision: Math.round(p.coords.accuracy) }), () => setH({ ...h, lat: o.pos[0], lng: o.pos[1], precision: 15 }), { timeout: 5000 });
  };
  const guardarHallazgo = () => {
    const er = validarHallazgo({ metodo: h.metodo, tipo: h.tipo, lat: h.lat, lng: h.lng, fotos: h.fotos.length }); setErrs(er); if (er.length) return;
    const id = nuevoId("HZ", get().hallazgos);
    actualizar((s) => { s.hallazgos.unshift({ id, orden: o.id, metodo: h.metodo as "acústico", tipo: h.tipo, pos: [h.lat!, h.lng!], precision: h.precision, fotos: h.fotos, ts: Date.now(), sincronizado: !sinSenal }); if (sinSenal) s.cola.push({ tipo: "hallazgo", payload: { id }, ts: Date.now() }); const x = s.ordenes.find((y) => y.id === o.id)!; if (x.estado !== "cerrada") x.estado = "en atención"; });
    registrar(sesion.correo, "registrar hallazgo", `${id} en ${o.id} (${h.metodo})`);
    setOk(sinSenal ? `Hallazgo ${id} guardado en el celular; se enviará al recuperar la señal.` : `Hallazgo ${id} registrado.`); setPaso("detalle");
  };
  const cerrar = () => {
    const er = validarCierre({ fotoFinal: c.foto, tipoReparacion: c.tipo, caudalRecuperadoLps: Number(c.lps.replace(",", ".") || 0) }); setErrs(er); if (er.length) return;
    const ahora = new Date(); const lps = Number(c.lps.replace(",", ".") || 0); const enPlazo = dentroDePlazo(new Date(o.conocida), ahora);
    actualizar((s) => { const x = s.ordenes.find((y) => y.id === o.id)!; x.estado = "cerrada"; x.cierre = { ts: ahora.getTime(), tipo: c.tipo, lps, foto: c.foto!, enPlazo, materiales: c.materiales.trim() || undefined }; if (sinSenal) s.cola.push({ tipo: "cierre", payload: { id: o.id }, ts: Date.now() }); });
    registrar(sesion.correo, "cerrar orden", `${o.id} ${enPlazo ? "dentro" : "fuera"} del plazo; ${nf(m3DiaRecuperados(lps), 1)} m³/día recuperados`);
    setOk(`Orden ${o.id} cerrada ${enPlazo ? "dentro del plazo" : "fuera del plazo"}. Se suman ${nf(m3DiaRecuperados(lps), 1)} m³/día recuperados.`); setTimeout(volver, 2500);
  };
  const foto = (f: File | undefined, cb: (n: string) => void) => { if (f) cb(f.name); };
  return (
    <div className="tarjeta">
      <button className="btn sec" onClick={volver} style={{ marginBottom: 12 }}>← Volver a mis órdenes</button>
      <h2>{o.id}</h2>
      <p>{o.descripcion}</p>
      <p><small>Conocida {fh(o.conocida)} · vence {fh(o.vence)}{o.tramo ? ` · tramo ${o.tramo}` : ""}</small></p>
      {rep && <p><small>Reportante: {rep.nombre} · {rep.telefono}</small></p>}
      <div aria-live="polite">{ok && <div className="aviso ok" role="status">{ok}</div>}{errs.length > 0 && <div className="aviso mal" role="alert"><ul style={{ margin: 0 }}>{errs.map((x) => <li key={x}>{x}</li>)}</ul></div>}</div>
      {paso === "detalle" && <div className="rejilla" style={{ gap: 10 }}>
        <MapaRed bajo sectores={e.sectores.filter((x) => x.id === o.sector)} tramos={e.tramos.filter((t) => t.sector === o.sector)} capas={{ sectores: true, tuberias: true, puntos: false, valvulas: true, hallazgos: false, alertas: false }} resaltar={o.tramo ? [o.tramo] : []} marcador={o.pos} />
        <a className="btn" href={`https://www.google.com/maps/dir/?api=1&destination=${o.pos[0]},${o.pos[1]}`} target="_blank" rel="noopener">Cómo llegar</a>
        <button className="btn" onClick={() => { setPaso("hallazgo"); setErrs([]); setOk(null); }}>Registrar hallazgo</button>
        <button className="btn" onClick={() => { setPaso("cierre"); setErrs([]); setOk(null); }}>Cerrar orden</button>
        <p className="sub">Hallazgos de esta orden: {e.hallazgos.filter((x) => x.orden === o.id).map((x) => `${x.id} (${x.metodo}${x.sincronizado ? "" : ", pendiente"})`).join(", ") || "ninguno"}</p>
      </div>}
      {paso === "hallazgo" && <div>
        <h3>Registrar hallazgo (HU19)</h3>
        <fieldset style={{ border: 0, padding: 0 }}><legend style={{ fontWeight: "bold", fontSize: ".88rem", marginBottom: 6 }}>Método de detección</legend>
          <div className="rejilla c3" style={{ gap: 8 }}>{["acústico", "térmico", "visual"].map((m) => <button key={m} type="button" className={`btn ${h.metodo === m ? "" : "sec"}`} aria-pressed={h.metodo === m} onClick={() => setH({ ...h, metodo: m })} style={{ textTransform: "capitalize" }}>{m}</button>)}</div></fieldset>
        <CampoF id="h-tipo" etiqueta="Tipo de fuga"><select id="h-tipo" value={h.tipo} onChange={(ev) => setH({ ...h, tipo: ev.target.value })}><option value="">— Elegir —</option><option>Fuga en tubería principal</option><option>Fuga en unión de tubería</option><option>Fuga en conexión domiciliaria</option><option>Fuga en válvula</option></select></CampoF>
        <button className="btn sec" type="button" onClick={gps} style={{ marginBottom: 8 }}>Tomar ubicación GPS</button>
        <p className="sub" aria-live="polite">{h.lat !== null ? `Ubicación: ${h.lat}, ${h.lng} (precisión ${h.precision} m)` : "Sin ubicación"}</p>
        <CampoF id="h-foto" etiqueta="Fotos del hallazgo"><input id="h-foto" type="file" accept="image/*" capture="environment" multiple onChange={(ev) => setH({ ...h, fotos: Array.from(ev.target.files ?? []).map((f) => f.name) })} /></CampoF>
        <div className="rejilla" style={{ gap: 8 }}><button className="btn" onClick={guardarHallazgo}>Guardar hallazgo</button><button className="btn sec" onClick={() => setPaso("detalle")}>Cancelar</button></div>
      </div>}
      {paso === "cierre" && <div>
        <h3>Cerrar orden (HU20)</h3>
        <CampoF id="c-tipo" etiqueta="Tipo de reparación"><select id="c-tipo" value={c.tipo} onChange={(ev) => setC({ ...c, tipo: ev.target.value })}><option value="">— Elegir —</option><option>Cambio de abrazadera</option><option>Cambio de tramo de tubería</option><option>Reparación de conexión domiciliaria</option><option>Cambio de válvula</option></select></CampoF>
        <CampoF id="c-mat" etiqueta="Materiales usados"><input id="c-mat" value={c.materiales} placeholder="Ej.: abrazadera 160 mm, 2 empaques" onChange={(ev) => setC({ ...c, materiales: ev.target.value })} /></CampoF>
        <CampoF id="c-lps" etiqueta="Caudal recuperado estimado (L/s)"><input id="c-lps" inputMode="decimal" value={c.lps} onChange={(ev) => setC({ ...c, lps: ev.target.value })} /></CampoF>
        <CampoF id="c-foto" etiqueta="Foto final de la reparación"><input id="c-foto" type="file" accept="image/*" capture="environment" onChange={(ev) => foto(ev.target.files?.[0], (n) => setC({ ...c, foto: n }))} /></CampoF>
        <div className="rejilla" style={{ gap: 8 }}><button className="btn" onClick={cerrar}>Cerrar orden</button><button className="btn sec" onClick={() => setPaso("detalle")}>Cancelar</button></div>
      </div>}
    </div>
  );
}

function LecturaManual({ sesion, sinSenal }: { sesion: Sesion; sinSenal: boolean }) {
  const [p, setP] = useState("P-SP01-02");
  const [v, setV] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ t: "ok" | "mal"; m: string } | null>(null);
  const guardar = () => {
    const pt = PUNTOS.find((x) => x.id === p)!;
    const lec = { punto: p, ts: new Date().toISOString(), valor: Number(v.replace(",", ".")), tipo: pt.tipo };
    const er = validarLectura(lec); if (!foto) er.push("Agregue la foto del medidor o manómetro");
    if (er.length) { setMsg({ t: "mal", m: er.join("; ") }); return; }
    const l = { punto: p, ts: Date.now(), valor: lec.valor, origen: "manual" as const };
    agregar(l); actualizar((s) => { s.lecturasExtra.push(l); if (sinSenal) s.cola.push({ tipo: "lectura", payload: l, ts: Date.now() }); });
    registrar(sesion.correo, "lectura manual", `${p}: ${lec.valor}`);
    setMsg({ t: "ok", m: sinSenal ? "Lectura guardada en el celular; se enviará al recuperar la señal." : "Lectura registrada con origen «manual»." }); setV(""); setFoto(null);
  };
  return (
    <div className="tarjeta">
      <h3>Lectura manual (HU07)</h3>
      <CampoF id="lm-punto" etiqueta="Punto de medición"><select id="lm-punto" value={p} onChange={(ev) => setP(ev.target.value)}>{PUNTOS.filter((x) => x.sector === "SP-01").map((x) => <option key={x.id}>{x.id}</option>)}</select></CampoF>
      <CampoF id="lm-valor" etiqueta={PUNTOS.find((x) => x.id === p)!.tipo === "caudal" ? "Caudal (L/s)" : "Presión (m)"}><input id="lm-valor" inputMode="decimal" value={v} onChange={(ev) => setV(ev.target.value)} /></CampoF>
      <CampoF id="lm-foto" etiqueta="Foto del medidor o manómetro"><input id="lm-foto" type="file" accept="image/*" capture="environment" onChange={(ev) => setFoto(ev.target.files?.[0]?.name ?? null)} /></CampoF>
      <button className="btn" onClick={guardar}>Guardar lectura</button>
      <div aria-live="polite">{msg && <div className={`aviso ${msg.t}`} role={msg.t === "mal" ? "alert" : "status"}>{msg.m}</div>}</div>
    </div>
  );
}
