import { useEffect, useRef, useState } from "react";
import { Pagina, Kpi, useEstado, nf, fh, descargar } from "../ui/comunes";
import { actualizar, registrar, get, reiniciarDemo, guardar, type Estado } from "../data/store";
import { latencias, percentil, serie } from "../data/live";
import { PILOTO } from "../data/gemelo";
import { balanceIWA, perdidasRealesNocturnas } from "../domain/hidraulica";
import { PERMISOS, type Rol } from "../domain/seguridad";
import type { Sesion } from "../ui/App";

// ---------- HU21 · HU23: Usuarios, roles y bitácora ----------
export function Usuarios({ sesion }: { sesion: Sesion }) {
  const e = useEstado();
  const [q, setQ] = useState("");
  const cambiarRol = (id: string, rol: Rol) => { const u = e.usuarios.find((x) => x.id === id)!; actualizar((s) => { s.usuarios.find((x) => x.id === id)!.rol = rol; }); registrar(sesion.correo, "cambiar rol", `${u.correo}: ${u.rol} → ${rol}`); };
  const activar = (id: string) => { const u = e.usuarios.find((x) => x.id === id)!; if (u.correo === sesion.correo) return; actualizar((s) => { const x = s.usuarios.find((y) => y.id === id)!; x.activo = !x.activo; }); registrar(sesion.correo, u.activo ? "desactivar usuario" : "activar usuario", u.correo); };
  const bit = e.bitacora.filter((b) => !q || `${b.usuario} ${b.accion} ${b.detalle}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Pagina titulo="Usuarios y bitácora" hu="HU21 · HU23" sub="Cada usuario ve solo los módulos de su rol. Toda acción relevante queda registrada con usuario, fecha y detalle; la bitácora no se puede editar.">
      <div className="tarjeta tabla-scroll">
        <h2>Usuarios</h2>
        <table aria-label="Usuarios"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Módulos</th><th>Estado</th></tr></thead>
          <tbody>{e.usuarios.map((u) => <tr key={u.id}><td>{u.nombre}</td><td>{u.correo}</td>
            <td><label className="sr" htmlFor={`rol-${u.id}`}>Rol de {u.correo}</label><select id={`rol-${u.id}`} value={u.rol} disabled={u.correo === sesion.correo} onChange={(ev) => cambiarRol(u.id, ev.target.value as Rol)}>{(Object.keys(PERMISOS) as Rol[]).map((r) => <option key={r} value={r}>{r}</option>)}</select></td>
            <td><small>{PERMISOS[u.rol].length} módulos</small></td>
            <td><button className="btn sec" style={{ minHeight: 32, padding: "4px 10px" }} disabled={u.correo === sesion.correo} onClick={() => activar(u.id)}>{u.activo ? "Activo · desactivar" : "Inactivo · activar"}</button></td></tr>)}</tbody></table>
        <p className="sub">Las contraseñas se guardan como hash SHA-256 con sal; tras 5 intentos fallidos la cuenta se bloquea 15 minutos.</p>
      </div>
      <div className="tarjeta tabla-scroll" style={{ marginTop: 16 }}>
        <div className="acciones" style={{ justifyContent: "space-between" }}><h2>Bitácora ({bit.length})</h2>
          <div className="acciones"><label htmlFor="bq" className="sr">Buscar en bitácora</label><input id="bq" placeholder="Buscar usuario o acción" value={q} onChange={(ev) => setQ(ev.target.value)} style={{ width: 220 }} />
            <button className="btn sec" onClick={() => descargar("bitacora_simpa.csv", "fecha,usuario,accion,detalle\n" + bit.map((b) => `${new Date(b.ts).toISOString()},${b.usuario},"${b.accion}","${b.detalle.replace(/"/g, "'")}"`).join("\n"))}>Exportar CSV</button></div></div>
        <table aria-label="Bitácora"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead>
          <tbody>{bit.slice(0, 100).map((b) => <tr key={b.id}><td>{fh(b.ts)}</td><td>{b.usuario}</td><td>{b.accion}</td><td>{b.detalle}</td></tr>)}</tbody></table>
      </div>
    </Pagina>
  );
}

// ---------- HU24: Rendimiento ----------
export function Rendimiento() {
  const [, tick] = useState(0);
  const [bench, setBench] = useState<{ ms: number; n: number } | null>(null);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 2000); return () => clearInterval(t); }, []);
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime;
  const carga = nav ? nav.loadEventEnd - nav.startTime : 0;
  const p50 = percentil(latencias, 50), p95 = percentil(latencias, 95);
  const correrBench = () => {
    const t0 = performance.now(); let n = 0;
    for (let d = 0; d < 365; d++) { balanceIWA({ ingresadoM3: PILOTO.ingresadoDia, facturadoM3: PILOTO.facturadoDia, autorizadoNoFacturadoM3: PILOTO.autorizadoNoFacturadoDia, perdidasRealesM3: perdidasRealesNocturnas({ qmn: PILOTO.qmnBase + Math.sin(d) * 0.5, usoLegitimo: 1.2, fnd: 21 }) }); n++; }
    const lect = serie("Q-SP01-ENT").length + serie("P-SP01-03").length;
    setBench({ ms: performance.now() - t0, n: n + lect });
  };
  return (
    <Pagina titulo="Rendimiento" hu="HU24" sub="Mediciones tomadas en este navegador. La latencia es el tiempo entre que el simulador emite una lectura y la pantalla de telemetría la pinta.">
      <div className="rejilla c4">
        <Kpi valor={`${nf(p50, 0)} ms`} etiqueta="Latencia p50 lectura → pantalla" meta={`${latencias.length} muestras`} estado={p50 < 1000 ? "verde" : "rojo"} />
        <Kpi valor={`${nf(p95, 0)} ms`} etiqueta="Latencia p95" meta="Meta: < 5 000 ms" estado={latencias.length ? (p95 < 5000 ? "verde" : "rojo") : undefined} />
        <Kpi valor={carga ? `${nf(carga / 1000, 2)} s` : "—"} etiqueta="Carga completa de la página" meta="Meta: < 3 s" estado={carga ? (carga < 3000 ? "verde" : "rojo") : undefined} />
        <Kpi valor={fcp ? `${nf(fcp, 0)} ms` : "—"} etiqueta="Primer contenido visible (FCP)" />
      </div>
      {!latencias.length && <div className="aviso" role="status" style={{ marginTop: 12 }}>Abra la pantalla de Telemetría unos segundos para acumular muestras de latencia.</div>}
      <div className="tarjeta" style={{ marginTop: 16 }}>
        <h2>Cálculo de un año de balance</h2>
        <p className="sub">Recalcula 365 balances diarios y recorre las series de 14 días. Meta: menos de 10 s.</p>
        <button className="btn" onClick={correrBench}>Ejecutar prueba</button>
        <div aria-live="polite">{bench && <div className="aviso ok" role="status" data-testid="bench">Procesados {nf(bench.n)} registros en <b>{nf(bench.ms, 1)} ms</b>.</div>}</div>
      </div>
    </Pagina>
  );
}

// ---------- HU26: Operación, respaldo y costos ----------
export function Operacion({ sesion }: { sesion: Sesion }) {
  const e = useEstado();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ t: "ok" | "mal"; m: string } | null>(null);
  const tam = (() => { try { return (localStorage.getItem("simpa:v1") ?? "").length; } catch { return 0; } })();
  const respaldar = () => { actualizar((s) => { s.ultimoRespaldo = Date.now(); }); descargar(`respaldo_simpa_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(get()), "application/json"); registrar(sesion.correo, "respaldo", "Respaldo JSON descargado"); setMsg({ t: "ok", m: "Respaldo descargado." }); };
  const restaurar = async (f?: File) => {
    if (!f) return;
    try { const d = JSON.parse(await f.text()) as Estado; if (d.version !== 1 || !Array.isArray(d.usuarios)) throw new Error("formato"); actualizar((s) => Object.assign(s, d)); guardar(); registrar(sesion.correo, "restaurar", f.name); setMsg({ t: "ok", m: `Datos restaurados desde ${f.name}.` }); }
    catch { setMsg({ t: "mal", m: "El archivo no es un respaldo válido de SIMPA. No se cambió nada." }); }
  };
  const costos = [["Hosting del front-end (Cloudflare Pages)", "Plan gratuito"], ["Base de datos y autenticación (Supabase)", "Plan gratuito: 500 MB, 50 000 usuarios activos"], ["Mapas (OpenStreetMap + Leaflet)", "Libre"], ["Repositorio y CI (GitHub + Actions)", "Gratuito"], ["Dominio", "Subdominio gratuito *.pages.dev"]];
  return (
    <Pagina titulo="Operación y respaldo" hu="HU26" sub="Estado del sistema, respaldo de datos y costo de operación.">
      <div className="rejilla c4">
        <Kpi valor={navigator.onLine ? "En línea" : "Sin conexión"} etiqueta="Estado de red" estado={navigator.onLine ? "verde" : "ámbar"} />
        <Kpi valor={`${nf(tam / 1024, 1)} KB`} etiqueta="Datos guardados" />
        <Kpi valor={e.ultimoRespaldo ? fh(e.ultimoRespaldo) : "Nunca"} etiqueta="Último respaldo" estado={e.ultimoRespaldo ? "verde" : "ámbar"} />
        <Kpi valor="S/ 0" etiqueta="Costo mensual de operación" estado="verde" />
      </div>
      <div aria-live="polite">{msg && <div className={`aviso ${msg.t}`} role={msg.t === "mal" ? "alert" : "status"} style={{ marginTop: 12 }}>{msg.m}</div>}</div>
      <div className="rejilla c2" style={{ marginTop: 16 }}>
        <div className="tarjeta"><h2>Respaldo</h2>
          <div className="acciones"><button className="btn" onClick={respaldar}>Descargar respaldo</button>
            <button className="btn sec" onClick={() => file.current?.click()}>Restaurar desde archivo</button>
            <input ref={file} type="file" accept="application/json" hidden onChange={(ev) => restaurar(ev.target.files?.[0])} aria-label="Archivo de respaldo" />
            <button className="btn sec" onClick={() => { if (confirm("¿Volver a los datos de demostración?")) { reiniciarDemo(); setMsg({ t: "ok", m: "Datos de demostración restablecidos." }); } }}>Reiniciar demostración</button></div></div>
        <div className="tarjeta"><h2>Costos de operación</h2><table><tbody>{costos.map(([a, b]) => <tr key={a}><td>{a}</td><td>{b}</td></tr>)}</tbody></table></div>
      </div>
    </Pagina>
  );
}

// ---------- HU25: Accesibilidad ----------
export function Accesibilidad() {
  const e = useEstado();
  const set = (k: "altoContraste" | "textoGrande", v: boolean) => actualizar((s) => { s.ajustes[k] = v; });
  return (
    <Pagina titulo="Accesibilidad" hu="HU25" sub="Ajustes que se aplican a toda la aplicación y se recuerdan en este equipo.">
      <div className="tarjeta" style={{ maxWidth: 560 }}>
        {([["altoContraste", "Alto contraste", "Fondo oscuro y textos claros, útil bajo el sol en campo."], ["textoGrande", "Texto grande", "Aumenta el tamaño de letra de toda la aplicación."]] as const).map(([k, t, d]) =>
          <label key={k} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontWeight: "normal", marginBottom: 14 }}><input type="checkbox" role="switch" style={{ width: 24, minHeight: 24 }} checked={e.ajustes[k]} onChange={(ev) => set(k, ev.target.checked)} /><span><b>{t}</b><br /><small>{d}</small></span></label>)}
        <h3>Atajos</h3>
        <ul><li><kbd>Tab</kbd> recorre los controles en orden; el primer enlace salta al contenido.</li><li>Todos los gráficos tienen descripción para lectores de pantalla.</li><li>Los estados no dependen solo del color: el semáforo muestra texto y horas.</li></ul>
      </div>
    </Pagina>
  );
}

// ---------- Acerca: mapa de pantallas y credenciales ----------
const MAPA_HU: [string, string, string][] = [
  ["HU01", "Ver mapa de red y sectores", "mapa"], ["HU02", "Gestionar sectores y puntos de medición", "sectores"], ["HU03", "Registrar tramos de tubería", "mapa"],
  ["HU04", "Recibir telemetría por API y simulador", "telemetria"], ["HU05", "Cargar lecturas por CSV", "telemetria"], ["HU06", "Ver telemetría en tiempo real", "telemetria"],
  ["HU07", "Registrar lecturas manuales", "campo"], ["HU08", "Calcular balance hídrico IWA", "balance"], ["HU09", "Calcular ILI", "balance"],
  ["HU10", "Detectar submedición", "submedicion"], ["HU11", "Alertar por caudal mínimo nocturno", "nocturno"], ["HU12", "Detectar anomalías de presión", "presiones"],
  ["HU13", "Bandeja de alertas priorizadas", "alertas"], ["HU14", "Estimar tramo probable", "alertas"], ["HU15", "Prueba de pasos", "pasos"],
  ["HU16", "Crear órdenes de trabajo", "ordenes"], ["HU17", "Plazo de 48 h con semáforo", "ordenes"], ["HU18", "App de cuadrilla sin señal", "campo"],
  ["HU19", "Registrar hallazgo", "campo"], ["HU20", "Cerrar orden con evidencia", "campo"], ["HU21", "Iniciar sesión según el rol", "usuarios"],
  ["HU22", "Tablero de indicadores", "tablero"], ["HU23", "Bitácora y protección de datos", "usuarios"], ["HU24", "Rendimiento", "rendimiento"],
  ["HU25", "Accesibilidad", "accesibilidad"], ["HU26", "Operación y respaldo a costo cero", "operacion"],
];
export function Acerca() {
  return (
    <main id="contenido" className="login" style={{ alignItems: "flex-start" }}>
      <div className="tarjeta" style={{ maxWidth: 900, width: "100%" }}>
        <h1 id="titulo-pagina">SIMPA · Prototipo funcional</h1>
        <p>Sistema Inteligente de Monitoreo de Pérdidas de Agua. Caso de estudio: SEDACUSCO, sector piloto SP-01 Wanchaq Norte. Los datos provienen de un gemelo digital que simula caudales y presiones con una fuga de 2,7 L/s en el tramo T-12.</p>
        <h2>Cuentas de demostración</h2>
        <p>Contraseña para todas: <code>Simpa2026!</code></p>
        <ul><li><b>jefe@simpa.pe</b>: todos los módulos</li><li><b>operador@simpa.pe</b>: monitoreo, alertas y órdenes</li><li><b>cuadrilla@simpa.pe</b>: app de campo</li><li><b>gerencia@simpa.pe</b>: tablero, balance y rendimiento</li></ul>
        <h2>Historias de usuario y pantallas</h2>
        <div className="tabla-scroll"><table><thead><tr><th>HU</th><th>Historia</th><th>Pantalla</th></tr></thead><tbody>{MAPA_HU.map(([h, t, r]) => <tr key={h}><td>{h}</td><td>{t}</td><td><a href={`#/${r}`}>#/{r}</a></td></tr>)}</tbody></table></div>
        <p style={{ marginTop: 14 }}><a className="btn" href="#/login">Ir a iniciar sesión</a></p>
      </div>
    </main>
  );
}

export function Denegado() {
  return (
    <Pagina titulo="Acceso denegado" hu="HU21" sub="Su rol no tiene permiso para ver este módulo.">
      <div className="aviso mal" role="alert">No tiene permisos para esta pantalla. Use el menú para ir a los módulos de su rol.</div>
    </Pagina>
  );
}

