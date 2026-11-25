import { useState, useMemo, useCallback } from "react";
import { MapaRed, type Capas } from "../ui/MapaRed";
import { Pagina, useEstado, Campo, descargar } from "../ui/comunes";
import { actualizar, registrar } from "../data/store";
import { PUNTOS } from "../data/gemelo";
import { validarTramo, importarSectores } from "../domain/validaciones";
import type { Sesion } from "../ui/App";

// ---------- HU01 · HU03: Mapa de la red y catastro ----------
export function Mapa({ sesion }: { sesion: Sesion }) {
  const e = useEstado();
  const [capas, setCapas] = useState<Capas>({ sectores: true, tuberias: true, puntos: true, valvulas: true, hallazgos: true, alertas: true });
  const [antig, setAntig] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const tramo = e.tramos.find((t) => t.id === sel);
  const [form, setForm] = useState({ material: "", diametroMm: 0, anio: 0, estado: "regular" });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [ok, setOk] = useState<string | null>(null);
  const onTramo = useCallback((id: string) => { const t = e.tramos.find((x) => x.id === id)!; setSel(id); setForm({ material: t.material, diametroMm: t.diametroMm, anio: t.anio, estado: t.estado }); setErrores({}); setOk(null); }, [e.tramos]);
  const guardar = (ev: React.FormEvent) => {
    ev.preventDefault();
    const err = validarTramo(form); setErrores(err);
    if (Object.keys(err).length) { setOk(null); return; }
    actualizar((s) => { const t = s.tramos.find((x) => x.id === sel)!; Object.assign(t, form); });
    registrar(sesion.correo, "editar catastro", `${sel}: ${form.material} Ø${form.diametroMm} mm, ${form.anio}`);
    setOk(`Tramo ${sel} actualizado.`);
  };
  const etiquetas: [keyof Capas, string][] = [["sectores", "Sectores"], ["tuberias", "Tuberías"], ["puntos", "Puntos de medición"], ["valvulas", "Válvulas"], ["hallazgos", "Hallazgos"], ["alertas", "Alertas"]];
  return (
    <Pagina titulo="Mapa de la red" hu="HU01 · HU03" sub="Red del sector piloto con sus sectores, tuberías, puntos de medición, válvulas, alertas y hallazgos. Seleccione un tramo para ver o editar su catastro.">
      <div className="rejilla c21">
        <div className="tarjeta">
          <fieldset className="acciones" style={{ border: 0, padding: 0, margin: "0 0 10px" }}><legend className="sr">Capas visibles</legend>
            {etiquetas.map(([k, t]) => <label key={k} style={{ display: "inline-flex", gap: 6, fontWeight: "normal", alignItems: "center", marginRight: 10 }}><input type="checkbox" style={{ width: 18, minHeight: 18 }} checked={capas[k]} onChange={() => setCapas({ ...capas, [k]: !capas[k] })} />{t}</label>)}
            <label style={{ display: "inline-flex", gap: 6, fontWeight: "normal", alignItems: "center" }}><input type="checkbox" style={{ width: 18, minHeight: 18 }} checked={antig} onChange={() => setAntig(!antig)} />Colorear por antigüedad</label>
          </fieldset>
          <MapaRed sectores={e.sectores} tramos={e.tramos} capas={capas} hallazgos={e.hallazgos} alertas={e.alertas} porAntiguedad={antig} onTramo={onTramo} />
          <div className="leyenda" aria-label="Leyenda">
            {antig ? <><span><i style={{ background: "#b3261e" }} />Antes de 1985</span><span><i style={{ background: "#c98a00" }} />1985–1999</span><span><i style={{ background: "#1c8c8c" }} />2000–2009</span><span><i style={{ background: "#1e7d32" }} />Desde 2010</span></>
              : <><span><i style={{ background: "#1c8c8c" }} />Tubería</span><span><i style={{ background: "#0b4f6c", borderRadius: "50%" }} />Caudal</span><span><i style={{ background: "#7a4f9e", borderRadius: "50%" }} />Presión</span><span><i style={{ background: "#888", borderRadius: "50%" }} />Sin datos</span><span><i style={{ background: "#fff", border: "2px solid #222", borderRadius: "50%" }} />Válvula</span></>}
          </div>
        </div>
        <div className="tarjeta" aria-live="polite">
          <h2>Ficha del tramo</h2>
          {!tramo ? <p className="sub">Seleccione un tramo en el mapa (o elija uno de la lista) para ver su catastro técnico.</p> : null}
          <Campo id="sel-tramo" etiqueta="Tramo"><select id="sel-tramo" value={sel ?? ""} onChange={(ev) => onTramo(ev.target.value)}><option value="">— Elegir —</option>{e.tramos.map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}</select></Campo>
          {tramo && <form onSubmit={guardar} noValidate>
            <Campo id="material" etiqueta="Material" error={errores.material}><select id="material" value={form.material} aria-invalid={!!errores.material} onChange={(ev) => setForm({ ...form, material: ev.target.value })}><option value="">— Elegir —</option>{["PVC", "Asbesto-cemento", "Fierro fundido", "PEAD"].map((m) => <option key={m}>{m}</option>)}</select></Campo>
            <Campo id="diametro" etiqueta="Diámetro (mm)" error={errores.diametroMm}><input id="diametro" type="number" inputMode="numeric" value={form.diametroMm} aria-invalid={!!errores.diametroMm} onChange={(ev) => setForm({ ...form, diametroMm: Number(ev.target.value) })} /></Campo>
            <Campo id="anio" etiqueta="Año de instalación" error={errores.anio}><input id="anio" type="number" inputMode="numeric" value={form.anio} aria-invalid={!!errores.anio} onChange={(ev) => setForm({ ...form, anio: Number(ev.target.value) })} /></Campo>
            <Campo id="estado" etiqueta="Estado"><select id="estado" value={form.estado} onChange={(ev) => setForm({ ...form, estado: ev.target.value })}><option>bueno</option><option>regular</option><option>malo</option></select></Campo>
            <button className="btn" type="submit" disabled={sesion.rol !== "jefe"}>Guardar catastro</button>
            {sesion.rol !== "jefe" && <p className="sub" style={{ marginTop: 6 }}>Solo el jefe de control de pérdidas puede editar.</p>}
            {ok && <div className="aviso ok" role="status">{ok}</div>}
          </form>}
        </div>
      </div>
    </Pagina>
  );
}

// ---------- HU02: Sectores y puntos de medición ----------
const EJEMPLO = { type: "FeatureCollection", features: [
  { type: "Feature", properties: { codigo: "SP-04", nombre: "Santa Úrsula" }, geometry: { type: "Polygon", coordinates: [[[-71.951, -13.522], [-71.945, -13.522], [-71.945, -13.527], [-71.951, -13.527], [-71.951, -13.522]]] } },
  { type: "Feature", properties: { codigo: "SP-05", nombre: "Tahuantinsuyo" }, geometry: { type: "Polygon", coordinates: [[[-71.944, -13.522], [-71.938, -13.522], [-71.938, -13.527], [-71.944, -13.527], [-71.944, -13.522]]] } },
  { type: "Feature", properties: { codigo: "SP-06", nombre: "Ttio" }, geometry: { type: "Polygon", coordinates: [[[-71.951, -13.528], [-71.945, -13.528], [-71.945, -13.533], [-71.951, -13.533], [-71.951, -13.528]]] } },
] };

export function Sectores({ sesion }: { sesion: Sesion }) {
  const e = useEstado();
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState<{ t: "ok" | "mal"; m: string } | null>(null);
  const [balanceMsg, setBalanceMsg] = useState<Record<string, string>>({});
  const conEntrada = useMemo(() => new Set(PUNTOS.filter((p) => p.rol === "entrada").map((p) => p.sector)), []);
  const importar = (raw: string) => {
    let json: unknown;
    try { json = JSON.parse(raw); } catch { setMsg({ t: "mal", m: "El archivo no es un JSON válido." }); return; }
    const r = importarSectores(json);
    if (!r.ok) { setMsg({ t: "mal", m: `Archivo rechazado: fila ${r.fila}, ${r.motivo}. No se guardó ningún sector.` }); return; }
    const nuevos = r.sectores.filter((s) => !e.sectores.some((x) => x.codigo === s.codigo));
    actualizar((s) => { for (const n of nuevos) s.sectores.push({ id: n.codigo, codigo: n.codigo, nombre: n.nombre, anillo: n.anillo.map(([lng, lat]) => [lat, lng]), redKm: 0, conexiones: 0, presionMedia: 0, continuo24h: false, piloto: false }); });
    registrar(sesion.correo, "importar sectores", `${nuevos.length} sectores: ${nuevos.map((n) => n.codigo).join(", ")}`);
    setMsg({ t: "ok", m: `Se importaron ${nuevos.length} sectores: ${nuevos.map((n) => `${n.codigo} ${n.nombre}`).join(", ")}.${nuevos.length < r.sectores.length ? " Los demás ya existían." : ""}` });
  };
  const archivo = (f?: File) => { if (f) f.text().then((t) => { setTexto(t); importar(t); }); };
  return (
    <Pagina titulo="Sectores y puntos de medición" hu="HU02" sub="Registre los sectores (DMA) importando un archivo GeoJSON y verifique que cada sector tenga un punto de entrada antes de calcular su balance.">
      <div className="rejilla c2">
        <div className="tarjeta">
          <h2>Sectores registrados ({e.sectores.length})</h2>
          <div className="tabla-scroll"><table><thead><tr><th>Código</th><th>Nombre</th><th className="num">Red (km)</th><th className="num">Conexiones</th><th>Servicio</th><th>Balance</th></tr></thead>
            <tbody>{e.sectores.map((s) => <tr key={s.id}><td><b>{s.codigo}</b>{s.piloto && <> <span className="chip azul">piloto</span></>}</td><td>{s.nombre}</td><td className="num">{s.redKm || "—"}</td><td className="num">{s.conexiones ? s.conexiones.toLocaleString("es-PE") : "—"}</td><td>{s.continuo24h ? "24 h" : "Intermitente"}</td>
              <td><button className="btn sec" onClick={() => setBalanceMsg({ ...balanceMsg, [s.id]: conEntrada.has(s.id) ? "Listo para calcular" : "Defina al menos un punto de entrada" })}>Verificar</button>{balanceMsg[s.id] && <div role="status" className={conEntrada.has(s.id) ? "" : "error"} style={{ fontSize: ".82rem", marginTop: 4 }}>{balanceMsg[s.id]}</div>}</td></tr>)}</tbody></table></div>
          <h3 style={{ marginTop: 16 }}>Puntos de medición</h3>
          <table><thead><tr><th>Código</th><th>Sector</th><th>Tipo</th><th>Rol</th></tr></thead><tbody>{PUNTOS.map((p) => <tr key={p.id}><td>{p.id}</td><td>{p.sector}</td><td>{p.tipo === "caudal" ? "Caudal" : "Presión"}</td><td>{p.rol}</td></tr>)}</tbody></table>
        </div>
        <div className="tarjeta">
          <h2>Importar sectores (GeoJSON)</h2>
          <p className="sub">El archivo debe ser un FeatureCollection de polígonos con las propiedades <code>codigo</code> y <code>nombre</code>. Si una fila tiene error, no se guarda nada.</p>
          <Campo id="geo-archivo" etiqueta="Archivo GeoJSON"><input id="geo-archivo" type="file" accept=".geojson,.json,application/json" onChange={(ev) => archivo(ev.target.files?.[0])} disabled={sesion.rol !== "jefe"} /></Campo>
          <Campo id="geo-texto" etiqueta="O pegue el contenido"><textarea id="geo-texto" value={texto} onChange={(ev) => setTexto(ev.target.value)} rows={6} /></Campo>
          <div className="acciones"><button className="btn" onClick={() => importar(texto)} disabled={sesion.rol !== "jefe" || !texto.trim()}>Importar</button><button className="btn sec" onClick={() => descargar("sectores-ejemplo.geojson", JSON.stringify(EJEMPLO, null, 2), "application/geo+json")}>Descargar ejemplo</button><button className="btn sec" onClick={() => setTexto(JSON.stringify(EJEMPLO))}>Usar ejemplo</button></div>
          <div aria-live="polite">{msg && <div className={`aviso ${msg.t}`} role={msg.t === "mal" ? "alert" : "status"}>{msg.m}</div>}</div>
        </div>
      </div>
    </Pagina>
  );
}
