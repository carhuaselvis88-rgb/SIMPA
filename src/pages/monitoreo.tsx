import { useEffect, useMemo, useRef, useState } from "react";
import { Pagina, Grafico, useEstado, useVivo, nf, fh, hora, Campo, descargar, Kpi } from "../ui/comunes";
import { serie, ultima, agregar, existe, registrarLatencia, simuladorPausado, pausarSimulador } from "../data/live";
import { PUNTOS, PILOTO, consumosSuministros } from "../data/gemelo";
import { actualizar, registrar, get, nuevoId } from "../data/store";
import { validarLectura, parsearCSV } from "../domain/validaciones";
import { balanceIWA, perdidasRealesNocturnas, uarl, ili, categoriaILI } from "../domain/hidraulica";
import { caudalMinimoNocturno, evaluarMNF, bandaEsperada, prioridadPorVolumen } from "../domain/alertas";
import { puntajeSubmedicion } from "../domain/validaciones";
import type { Sesion } from "../ui/App";

const H = 3600 * 1000;
/** Fecha local en formato de <input type="datetime-local">. */
const localISO = (t: number) => { const d = new Date(t - new Date(t).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
const TOKENS: Record<string, string> = { "Q-SP01-ENT": "tok-q-sp01-7f3a", "P-SP01-01": "tok-p1-21bd", "P-SP01-02": "tok-p2-9c44", "P-SP01-03": "tok-p3-e017", "P-SP01-04": "tok-p4-55aa" };

// ---------- HU04 · HU05 · HU06: Telemetría ----------
export function Telemetria({ sesion }: { sesion: Sesion }) {
  useVivo();
  const e = useEstado();
  const [punto, setPunto] = useState("Q-SP01-ENT");
  const [periodo, setPeriodo] = useState<"24h" | "semana">("24h");
  const [pausa, setPausa] = useState(simuladorPausado());
  const p = PUNTOS.find((x) => x.id === punto)!;
  const datos = serie(punto).filter((l) => l.ts > Date.now() - (periodo === "24h" ? 24 : 168) * H);
  const u = ultima(punto);
  const ref = useRef<number | undefined>(undefined);
  useEffect(() => { if (u?.emitido && ref.current !== u.ts) { ref.current = u.ts; registrarLatencia(performance.now() - u.emitido); } });
  const vals = datos.map((d) => d.valor);
  // Consola de la API de ingesta (simula POST /ingest)
  const [api, setApi] = useState({ punto: "Q-SP01-ENT", token: TOKENS["Q-SP01-ENT"], valor: "24.8", ts: localISO(Date.now()) });
  const [resp, setResp] = useState<{ code: number; body: string } | null>(null);
  const enviar = (ev: React.FormEvent) => {
    ev.preventDefault();
    const pt = PUNTOS.find((x) => x.id === api.punto);
    if (!api.token || TOKENS[api.punto] !== api.token) { setResp({ code: 401, body: JSON.stringify({ error: "token inválido o ausente" }) }); actualizar((s) => { s.rechazos.unshift({ ts: Date.now(), punto: api.punto, motivo: "401 token inválido" }); }); return; }
    const ts = new Date(api.ts).getTime();
    const lec = { punto: api.punto, ts: new Date(ts).toISOString(), valor: Number(api.valor), tipo: pt?.tipo };
    const errs = validarLectura(lec);
    if (!errs.length && existe(api.punto, ts)) errs.push("lectura duplicada para el mismo punto y hora");
    if (errs.length) { setResp({ code: 422, body: JSON.stringify({ error: errs }) }); actualizar((s) => { s.rechazos.unshift({ ts: Date.now(), punto: api.punto, motivo: "422 " + errs.join("; ") }); }); return; }
    const l = { punto: api.punto, ts, valor: Number(api.valor), origen: "api" as const };
    agregar(l); actualizar((s) => { s.lecturasExtra.push(l); });
    setResp({ code: 201, body: JSON.stringify({ ok: true, punto: api.punto, ts: new Date(ts).toISOString(), valor: Number(api.valor) }) });
  };
  // Carga CSV (HU05)
  const [csv, setCsv] = useState<{ cargadas: number; duplicadas: number; errores: { fila: number; error?: string }[] } | null>(null);
  const cargarCSV = async (f?: File) => {
    if (!f) return;
    const r = parsearCSV(await f.text());
    let cargadas = 0, duplicadas = 0;
    const nuevas: typeof e.lecturasExtra = [];
    for (const l of r.validas) { const ts = Date.parse(l.ts); if (existe(l.punto, ts) || nuevas.some((n) => n.punto === l.punto && n.ts === ts)) { duplicadas++; continue; } nuevas.push({ punto: l.punto, ts, valor: l.valor, origen: "csv" }); cargadas++; }
    nuevas.forEach((n) => agregar(n));
    actualizar((s) => { s.lecturasExtra.push(...nuevas); });
    registrar(sesion.correo, "cargar CSV", `${cargadas} lecturas, ${duplicadas} duplicadas, ${r.errores.length} con error`);
    setCsv({ cargadas, duplicadas, errores: r.errores });
  };
  const plantilla = "punto,fecha_hora,valor,tipo\nQ-SP01-ENT,2026-11-20T00:00:00-05:00,24.1,caudal\nP-SP01-01,2026-11-20T00:00:00-05:00,36.2,presion\n";
  const estadoPunto = (id: string) => { const x = ultima(id); return !x || Date.now() - x.ts > H ? "sin datos" : "normal"; };
  return (
    <Pagina titulo="Telemetría en tiempo real" hu="HU04 · HU05 · HU06" sub="Lecturas de caudal y presión cada 15 minutos. En modo demostración, el simulador del gemelo digital envía una lectura cada 4 segundos.">
      <div className="rejilla c4" style={{ marginBottom: 16 }}>
        {PUNTOS.filter((x) => x.sector === "SP-01").slice(0, 4).map((x) => { const l = ultima(x.id); const st = estadoPunto(x.id); return <div className="tarjeta kpi" key={x.id}><div className="v">{l ? nf(l.valor, 1) : "—"} <small style={{ fontSize: ".9rem" }}>{x.tipo === "caudal" ? "L/s" : "m"}</small></div><div className="l">{x.id}</div><div className="m"><span className={`chip ${st === "normal" ? "verde" : "gris"}`}>{st === "normal" ? "● normal" : "○ sin datos"}</span> {l && hora(l.ts)}</div></div>; })}
      </div>
      <div className="tarjeta" style={{ marginBottom: 16 }}>
        <div className="acciones" style={{ justifyContent: "space-between" }}>
          <h2>Serie del punto {punto}</h2>
          <div className="acciones">
            <label htmlFor="sel-punto" className="sr">Punto</label><select id="sel-punto" style={{ width: "auto" }} value={punto} onChange={(ev) => setPunto(ev.target.value)}>{PUNTOS.map((x) => <option key={x.id}>{x.id}</option>)}</select>
            <label htmlFor="sel-periodo" className="sr">Periodo</label><select id="sel-periodo" style={{ width: "auto" }} value={periodo} onChange={(ev) => setPeriodo(ev.target.value as "24h" | "semana")}><option value="24h">Últimas 24 h</option><option value="semana">Semana</option></select>
            <button className="btn sec" onClick={() => { pausarSimulador(!pausa); setPausa(!pausa); }}>{pausa ? "Reanudar simulador" : "Pausar simulador"}</button>
          </div>
        </div>
        <Grafico titulo={`Serie de ${punto}`} unidad={p.tipo === "caudal" ? "L/s" : "m"} series={[{ nombre: p.tipo === "caudal" ? "Caudal" : "Presión", color: "#0b4f6c", puntos: datos.map((d) => ({ x: d.ts, y: d.valor })) }]} formatoX={periodo === "24h" ? hora : (x) => new Date(x).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" })} />
        {vals.length > 0 && <p className="sub" style={{ marginTop: 8 }} aria-live="polite">Mínimo {nf(Math.min(...vals), 1)} · Máximo {nf(Math.max(...vals), 1)} · Promedio {nf(vals.reduce((a, b) => a + b, 0) / vals.length, 1)} {p.tipo === "caudal" ? "L/s" : "m"} · {vals.length} lecturas · última {u && hora(u.ts)}</p>}
      </div>
      <div className="rejilla c2">
        <div className="tarjeta">
          <h2>API de ingesta (HU04)</h2>
          <p className="sub">Simula <code>POST /ingest</code> con el token del punto de medición.</p>
          <form onSubmit={enviar} noValidate>
            <div className="rejilla c2" style={{ gap: 10 }}>
              <Campo id="api-punto" etiqueta="Punto"><select id="api-punto" value={api.punto} onChange={(ev) => setApi({ ...api, punto: ev.target.value, token: TOKENS[ev.target.value] ?? "" })}>{PUNTOS.map((x) => <option key={x.id}>{x.id}</option>)}</select></Campo>
              <Campo id="api-token" etiqueta="Token"><input id="api-token" value={api.token} onChange={(ev) => setApi({ ...api, token: ev.target.value })} /></Campo>
              <Campo id="api-ts" etiqueta="Fecha y hora"><input id="api-ts" type="datetime-local" value={api.ts} onChange={(ev) => setApi({ ...api, ts: ev.target.value })} /></Campo>
              <Campo id="api-valor" etiqueta="Valor"><input id="api-valor" inputMode="decimal" value={api.valor} onChange={(ev) => setApi({ ...api, valor: ev.target.value })} /></Campo>
            </div>
            <button className="btn" type="submit">Enviar lectura</button>
          </form>
          <div aria-live="polite">{resp && <div className={`aviso ${resp.code === 201 ? "ok" : "mal"}`} data-testid="respuesta-api" role="status"><b>HTTP {resp.code}</b> <code style={{ wordBreak: "break-all" }}>{resp.body}</code></div>}</div>
          <h3 style={{ marginTop: 12 }}>Bitácora de rechazos</h3>
          {e.rechazos.length === 0 ? <p className="sub">Sin rechazos.</p> : <table><thead><tr><th>Hora</th><th>Punto</th><th>Motivo</th></tr></thead><tbody>{e.rechazos.slice(0, 6).map((r, i) => <tr key={i}><td>{fh(r.ts)}</td><td>{r.punto}</td><td>{r.motivo}</td></tr>)}</tbody></table>}
        </div>
        <div className="tarjeta">
          <h2>Carga de lecturas por CSV (HU05)</h2>
          <p className="sub">Columnas: <code>punto,fecha_hora,valor,tipo</code>. Las filas con error se informan; las duplicadas se omiten.</p>
          <Campo id="csv" etiqueta="Archivo CSV"><input id="csv" type="file" accept=".csv,text/csv" onChange={(ev) => cargarCSV(ev.target.files?.[0])} /></Campo>
          <button className="btn sec" onClick={() => descargar("plantilla-lecturas.csv", plantilla)}>Descargar plantilla</button>
          <div aria-live="polite">{csv && <div className={`aviso ${csv.errores.length ? "alerta" : "ok"}`} role="status" data-testid="resumen-csv"><b>{csv.cargadas}</b> lecturas cargadas · <b>{csv.duplicadas}</b> duplicadas omitidas · <b>{csv.errores.length}</b> filas con error{csv.errores.length > 0 && <ul>{csv.errores.slice(0, 8).map((x) => <li key={x.fila}>Fila {x.fila}: {x.error}</li>)}</ul>}</div>}</div>
        </div>
      </div>
    </Pagina>
  );
}

// ---------- HU08 · HU09: Balance hídrico e ILI ----------
export function Balance({ sesion }: { sesion: Sesion }) {
  const e = useEstado();
  const [periodo, setPeriodo] = useState("2026-10");
  const dias = periodo === "2026-09" ? 30 : 31;
  const fact = e.facturado[periodo];
  const [nuevo, setNuevo] = useState("");
  let res: ReturnType<typeof balanceIWA> | null = null; let error: string | null = null;
  try { res = balanceIWA({ ingresadoM3: PILOTO.ingresadoDia * dias, facturadoM3: fact, autorizadoNoFacturadoM3: PILOTO.autorizadoNoFacturadoDia * dias, perdidasRealesM3: perdidasRealesNocturnas({ qmn: PILOTO.qmnBase, usoLegitimo: PILOTO.usoLegitimo, fnd: PILOTO.fnd }) * dias }); } catch (x) { error = (x as Error).message; }
  const u = uarl({ lm: 18, nc: 2400, lp: 0, presion: 35 });
  const iliV = res ? ili(res.realesM3 / dias, u) : null;
  const cat = iliV ? categoriaILI(iliV) : null;
  const barra = (v: number, c: string, t: string) => res && <div title={t} style={{ width: `${(v / res.ingresadoM3) * 100}%`, background: c, color: "#fff", padding: "8px 6px", fontSize: ".8rem", whiteSpace: "nowrap", overflow: "hidden" }}>{t}</div>;
  return (
    <Pagina titulo="Balance hídrico e ILI" hu="HU08 · HU09" sub="Balance IWA del sector piloto SP-01 por periodo: volumen ingresado, facturado y agua no facturada separada en pérdidas reales, aparentes y consumo autorizado no facturado.">
      <div className="acciones" style={{ marginBottom: 12 }}><label htmlFor="periodo" style={{ margin: 0 }}>Periodo</label><select id="periodo" style={{ width: "auto" }} value={periodo} onChange={(ev) => setPeriodo(ev.target.value)}><option value="2026-09">Setiembre 2026</option><option value="2026-10">Octubre 2026</option><option value="2026-11">Noviembre 2026</option></select></div>
      {error && <div className="aviso mal" role="alert" data-testid="balance-error"><b>{error}.</b> Cargue el volumen facturado del periodo para calcular el ANF.
        {sesion.rol === "jefe" && <form className="acciones" style={{ marginTop: 8 }} onSubmit={(ev) => { ev.preventDefault(); const v = Number(nuevo); if (v > 0) { actualizar((s) => { s.facturado[periodo] = v; }); registrar(sesion.correo, "cargar facturación", `${periodo}: ${v} m³`); } }}><label htmlFor="fact" className="sr">Volumen facturado</label><input id="fact" style={{ width: 200 }} inputMode="numeric" placeholder="m³ facturados del mes" value={nuevo} onChange={(ev) => setNuevo(ev.target.value)} /><button className="btn">Guardar</button></form>}</div>}
      {res && <>
        <div className="rejilla c4" style={{ marginBottom: 16 }}>
          <Kpi valor={`${nf(res.anfPct, 2)} %`} etiqueta="Agua no facturada (ANF)" meta="Meta ≤ 31 %" estado={res.anfPct <= 31 ? "verde" : "rojo"} />
          <Kpi valor={nf(res.anfM3)} etiqueta={`m³ de ANF en ${dias} días`} />
          <Kpi valor={nf(iliV!, 1)} etiqueta={`ILI · categoría ${cat!.cat}`} meta={`UARL ${nf(u, 1)} m³/día`} estado={cat!.cat === "A" ? "verde" : cat!.cat === "B" ? "ámbar" : "rojo"} />
          <Kpi valor={`S/ ${nf(res.anfM3 * PILOTO.tarifa)}`} etiqueta="Valor del ANF del periodo (tarifa referencial S/ 2,50/m³)" />
        </div>
        <div className="tarjeta" style={{ marginBottom: 16 }}>
          <h2>Composición del volumen ingresado</h2>
          <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid var(--borde)" }} role="img" aria-label={`Facturado ${nf(res.facturadoM3)} m³, pérdidas reales ${nf(res.realesM3)} m³, aparentes ${nf(res.aparentesM3)} m³, autorizado no facturado ${nf(res.autorizadoNoFacturadoM3)} m³`}>
            {barra(res.facturadoM3, "#1e7d32", "Facturado")}{barra(res.realesM3, "#b3261e", "Reales")}{barra(res.aparentesM3, "#8a5a00", "Aparentes")}{barra(res.autorizadoNoFacturadoM3, "#4a5a66", "Aut.")}
          </div>
          <table style={{ marginTop: 12 }}><thead><tr><th>Componente</th><th className="num">m³</th><th className="num">% del ingresado</th></tr></thead><tbody>
            {[["Volumen ingresado", res.ingresadoM3], ["Consumo facturado", res.facturadoM3], ["Agua no facturada (ANF)", res.anfM3], ["· Pérdidas reales (fugas)", res.realesM3], ["· Pérdidas aparentes (submedición, clandestinas)", res.aparentesM3], ["· Consumo autorizado no facturado", res.autorizadoNoFacturadoM3]].map(([t, v]) => <tr key={t as string}><td>{t}</td><td className="num">{nf(v as number)}</td><td className="num">{nf(((v as number) / res!.ingresadoM3) * 100, 2)} %</td></tr>)}
          </tbody></table>
          <div className="aviso info" style={{ marginTop: 12 }}><b>Categoría {cat!.cat}:</b> {cat!.texto}.</div>
        </div>
      </>}
    </Pagina>
  );
}

// ---------- HU11: Caudal mínimo nocturno ----------
export function Nocturno({ sesion }: { sesion: Sesion }) {
  useVivo();
  const e = useEstado();
  const base = PILOTO.qmnBase;
  const dias = useMemo(() => {
    const s = serie("Q-SP01-ENT"); const out: { dia: number; qmn: number; alerta: boolean; var: number; perd: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d0 = new Date(); d0.setHours(0, 0, 0, 0); d0.setDate(d0.getDate() - i);
      const del = s.filter((l) => l.ts >= d0.getTime() && l.ts < d0.getTime() + 24 * H).map((l) => ({ ts: new Date(l.ts), valor: l.valor }));
      const q = caudalMinimoNocturno(del); if (q === null) continue;
      const ev = evaluarMNF(q, base);
      out.push({ dia: d0.getTime(), qmn: q, alerta: ev.alerta, var: ev.variacionPct, perd: perdidasRealesNocturnas({ qmn: q, usoLegitimo: PILOTO.usoLegitimo, fnd: PILOTO.fnd }) });
    }
    return out;
  }, []);
  const [msg, setMsg] = useState<string | null>(null);
  const ejecutar = () => {
    const ult = dias[dias.length - 1];
    if (!ult) return;
    if (!ult.alerta) { setMsg(`Cálculo ejecutado: caudal mínimo ${nf(ult.qmn, 2)} L/s (${nf(ult.var, 1)} %). Variación normal, sin alerta.`); return; }
    const ya = e.alertas.find((a) => a.tipo === "posible fuga" && a.estado === "abierta");
    if (ya) { setMsg(`Cálculo ejecutado: ${nf(ult.qmn, 2)} L/s (+${nf(ult.var, 1)} %). Alerta vigente ${ya.id}.`); return; }
    const m3 = Math.round(perdidasRealesNocturnas({ qmn: ult.qmn, usoLegitimo: 1.2, fnd: 21 }) - perdidasRealesNocturnas({ qmn: base, usoLegitimo: 1.2, fnd: 21 }));
    const id = nuevoId("AL", get().alertas);
    actualizar((s) => { s.alertas.unshift({ id, sector: "SP-01", tipo: "posible fuga", prioridad: prioridadPorVolumen(m3), m3Dia: m3, creada: Date.now(), estado: "abierta", detalle: `Caudal mínimo nocturno ${nf(ult.qmn, 1)} L/s vs línea base ${nf(base, 1)} L/s (+${nf(ult.var, 1)} %)` }); });
    registrar(sesion.correo, "generar alerta", id);
    setMsg(`Se generó la alerta ${id}.`);
  };
  return (
    <Pagina titulo="Caudal mínimo nocturno" hu="HU11" sub="Cada día a las 05:00 se calcula el caudal mínimo entre las 02:00 y las 04:00 y se compara con la línea base. Si la supera en más de 20 %, se genera una alerta de posible fuga.">
      <div className="tarjeta" style={{ marginBottom: 16 }}>
        <Grafico titulo="Caudal mínimo nocturno de los últimos 14 días" unidad="L/s" formatoX={(x) => new Date(x).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" })} umbral={{ y: base * 1.2, texto: "Umbral de alerta (+20 %)" }}
          series={[{ nombre: "Caudal mínimo nocturno", color: "#0b4f6c", puntos: dias.map((d) => ({ x: d.dia, y: d.qmn })) }, { nombre: "Línea base 9,8 L/s", color: "#1e7d32", discontinua: true, puntos: dias.map((d) => ({ x: d.dia, y: base })) }]} />
        <div className="acciones" style={{ marginTop: 8 }}><button className="btn" onClick={ejecutar}>Ejecutar cálculo de las 05:00</button></div>
        <div aria-live="polite">{msg && <div className="aviso info" role="status">{msg}</div>}</div>
      </div>
      <div className="tarjeta tabla-scroll">
        <table><thead><tr><th>Día</th><th className="num">Caudal mínimo (L/s)</th><th className="num">Variación vs base</th><th className="num">Pérdidas reales estimadas (m³/día)</th><th>Resultado</th></tr></thead>
          <tbody>{dias.slice().reverse().map((d) => <tr key={d.dia}><td>{new Date(d.dia).toLocaleDateString("es-PE")}</td><td className="num">{nf(d.qmn, 2)}</td><td className="num">{d.var >= 0 ? "+" : ""}{nf(d.var, 1)} %</td><td className="num">{nf(d.perd)}</td><td>{d.alerta ? <span className="chip rojo">Posible fuga</span> : <span className="chip verde">Normal</span>}</td></tr>)}</tbody></table>
      </div>
    </Pagina>
  );
}

// ---------- HU12: Presiones con banda esperada ----------
export function Presiones() {
  useVivo();
  const [punto, setPunto] = useState("P-SP01-03");
  const s = serie(punto);
  const hasta = Date.now(), desde = hasta - 48 * H;
  const hist = s.filter((l) => l.ts < hasta - 48 * H);
  const recientes = s.filter((l) => l.ts >= desde);
  const bandas = recientes.map((l) => { const hh = new Date(l.ts).getHours(); const vals = hist.filter((x) => new Date(x.ts).getHours() === hh).map((x) => x.valor); const b = vals.length > 2 ? bandaEsperada(vals) : { min: l.valor, max: l.valor, media: l.valor, sigma: 0 }; return { x: l.ts, min: b.min, max: b.max, fuera: l.valor < b.min || l.valor > b.max }; });
  const fuera = bandas.filter((b) => b.fuera).length;
  return (
    <Pagina titulo="Analítica de presiones" hu="HU12" sub="Presión real frente a la banda esperada μ ± 3σ de cada hora, calculada con el historial del punto. Una caída fuera de la banda genera una alerta en el siguiente ciclo de 15 minutos.">
      <div className="tarjeta">
        <div className="acciones" style={{ justifyContent: "space-between" }}><h2>Punto {punto}</h2><div><label htmlFor="pp" className="sr">Punto de presión</label><select id="pp" style={{ width: "auto" }} value={punto} onChange={(ev) => setPunto(ev.target.value)}>{PUNTOS.filter((p) => p.tipo === "presion").map((p) => <option key={p.id}>{p.id}</option>)}</select></div></div>
        <Grafico titulo={`Presión de ${punto} y banda esperada`} unidad="m" banda={bandas} series={[{ nombre: "Presión real", color: "#0b4f6c", puntos: recientes.map((l) => ({ x: l.ts, y: l.valor })) }]} formatoX={(x) => fh(x)} />
        <div className={`aviso ${fuera ? "alerta" : "ok"}`} role="status">{fuera ? `${fuera} lecturas de las últimas 48 h están fuera de la banda esperada.` : "Todas las lecturas de las últimas 48 h están dentro de la banda esperada."}</div>
      </div>
    </Pagina>
  );
}

// ---------- HU10: Submedición ----------
export function Submedicion() {
  const [res, setRes] = useState<{ codigo: string; sector: string; puntaje: number; motivos: string[] }[] | null>(null);
  const [sector, setSector] = useState("SP-01");
  const analizar = () => setRes(consumosSuministros().map((s) => ({ codigo: s.codigo, sector: s.sector, ...puntajeSubmedicion(s.consumos, s.anioMedidor, 2026) })).filter((x) => x.puntaje > 0));
  const lista = (res ?? []).filter((r) => r.sector === sector).sort((a, b) => b.puntaje - a.puntaje);
  return (
    <Pagina titulo="Análisis de submedición" hu="HU10" sub="Identifica suministros con consumo cero, plano o en caída y medidores antiguos, a partir de 12 meses de consumo facturado.">
      <div className="tarjeta">
        <div className="acciones"><button className="btn" onClick={analizar}>Ejecutar análisis (12 meses)</button><label htmlFor="sec-sub" className="sr">Sector</label><select id="sec-sub" style={{ width: "auto" }} value={sector} onChange={(ev) => setSector(ev.target.value)}><option>SP-01</option><option>SP-02</option></select>
          {res && <button className="btn sec" onClick={() => descargar(`submedicion-${sector}.csv`, "codigo,sector,puntaje,motivos\n" + lista.map((l) => `${l.codigo},${l.sector},${l.puntaje},"${l.motivos.join("; ")}"`).join("\n"))}>Exportar CSV</button>}</div>
        {res && <div className="tabla-scroll" style={{ marginTop: 12 }}><table><thead><tr><th>Suministro</th><th>Sector</th><th className="num">Puntaje de sospecha</th><th>Motivos</th></tr></thead><tbody>{lista.map((l) => <tr key={l.codigo}><td>{l.codigo}</td><td>{l.sector}</td><td className="num"><span className={`chip ${l.puntaje >= 60 ? "rojo" : l.puntaje >= 30 ? "ámbar" : "gris"}`}>{l.puntaje}</span></td><td>{l.motivos.join("; ")}</td></tr>)}</tbody></table>
          <p className="sub" style={{ marginTop: 8 }}>{lista.length} suministros sospechosos en {sector}.</p></div>}
      </div>
    </Pagina>
  );
}
