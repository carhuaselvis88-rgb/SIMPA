import { useEffect, useState, type ReactNode } from "react";
import { get, actualizar, registrar } from "../data/store";
import { puedeVer, registrarIntento, estaBloqueado, hashClave, type Rol } from "../domain/seguridad";
import { arrancarSimulador } from "../data/live";
import { useEstado } from "./comunes";
import * as P from "../pages";

export interface Sesion { correo: string; nombre: string; rol: Rol; cuadrilla?: string }

const RUTAS: { ruta: string; texto: string; modulo: string; grupo: string; icono: string; comp: (s: Sesion) => ReactNode }[] = [
  { ruta: "tablero", texto: "Tablero de indicadores", modulo: "tablero", grupo: "Gestión", icono: "▦", comp: () => <P.Tablero /> },
  { ruta: "mapa", texto: "Mapa de la red", modulo: "mapa", grupo: "Red", icono: "⌖", comp: (s) => <P.Mapa sesion={s} /> },
  { ruta: "sectores", texto: "Sectores y puntos", modulo: "sectores", grupo: "Red", icono: "▱", comp: (s) => <P.Sectores sesion={s} /> },
  { ruta: "telemetria", texto: "Telemetría", modulo: "telemetria", grupo: "Monitoreo", icono: "∿", comp: (s) => <P.Telemetria sesion={s} /> },
  { ruta: "balance", texto: "Balance hídrico e ILI", modulo: "balance", grupo: "Monitoreo", icono: "⚖", comp: (s) => <P.Balance sesion={s} /> },
  { ruta: "nocturno", texto: "Caudal mínimo nocturno", modulo: "nocturno", grupo: "Monitoreo", icono: "☾", comp: (s) => <P.Nocturno sesion={s} /> },
  { ruta: "presiones", texto: "Presiones", modulo: "presiones", grupo: "Monitoreo", icono: "◔", comp: () => <P.Presiones /> },
  { ruta: "submedicion", texto: "Submedición", modulo: "submedicion", grupo: "Monitoreo", icono: "≋", comp: () => <P.Submedicion /> },
  { ruta: "alertas", texto: "Alertas", modulo: "alertas", grupo: "Atención", icono: "⚠", comp: (s) => <P.Alertas sesion={s} /> },
  { ruta: "pasos", texto: "Prueba de pasos", modulo: "pasos", grupo: "Atención", icono: "⇢", comp: (s) => <P.PruebaPasos sesion={s} /> },
  { ruta: "ordenes", texto: "Órdenes de trabajo", modulo: "ordenes", grupo: "Atención", icono: "☰", comp: (s) => <P.Ordenes sesion={s} /> },
  { ruta: "campo", texto: "App de cuadrilla", modulo: "campo", grupo: "Campo", icono: "◉", comp: (s) => <P.Campo sesion={s} /> },
  { ruta: "usuarios", texto: "Usuarios y bitácora", modulo: "usuarios", grupo: "Administración", icono: "☺", comp: (s) => <P.Usuarios sesion={s} /> },
  { ruta: "rendimiento", texto: "Rendimiento", modulo: "rendimiento", grupo: "Administración", icono: "⏱", comp: () => <P.Rendimiento /> },
  { ruta: "operacion", texto: "Operación y respaldo", modulo: "operacion", grupo: "Administración", icono: "⛁", comp: (s) => <P.Operacion sesion={s} /> },
  { ruta: "accesibilidad", texto: "Accesibilidad", modulo: "accesibilidad", grupo: "Administración", icono: "◐", comp: () => <P.Accesibilidad /> },
];

const NOMBRE_ROL: Record<Rol, string> = { jefe: "Jefe de control de pérdidas", operador: "Operador de monitoreo", cuadrilla: "Cuadrilla", gerencia: "Gerencia" };

function useRuta() {
  const [r, setR] = useState(() => location.hash.replace(/^#\/?/, ""));
  useEffect(() => { const f = () => setR(location.hash.replace(/^#\/?/, "")); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return r;
}

export function irA(ruta: string) { location.hash = "#/" + ruta; }

export default function App() {
  const e = useEstado();
  const [sesion, setSesion] = useState<Sesion | null>(() => { try { return JSON.parse(sessionStorage.getItem("simpa:sesion") ?? "null"); } catch { return null; } });
  const ruta = useRuta();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); addEventListener("online", on); addEventListener("offline", off); return () => { removeEventListener("online", on); removeEventListener("offline", off); }; }, []);
  useEffect(() => { document.documentElement.classList.toggle("alto-contraste", e.ajustes.altoContraste); document.documentElement.classList.toggle("texto-grande", e.ajustes.textoGrande); }, [e.ajustes]);
  useEffect(() => { if (sesion) arrancarSimulador(); }, [sesion]);

  if (ruta === "acerca") return <P.Acerca />;
  if (!sesion) return <Login onEntrar={(s) => { sessionStorage.setItem("simpa:sesion", JSON.stringify(s)); setSesion(s); irA(s.rol === "cuadrilla" ? "campo" : "tablero"); }} />;

  const visibles = RUTAS.filter((r) => puedeVer(sesion.rol, r.modulo));
  const actual = RUTAS.find((r) => r.ruta === ruta);
  const permitido = actual && puedeVer(sesion.rol, actual.modulo);
  const destino = actual ? (permitido ? actual.comp(sesion) : <P.Denegado />) : null;
  if (!actual) { setTimeout(() => irA(visibles[0].ruta)); }
  const salir = () => { registrar(sesion.correo, "cerrar sesión", "Fin de sesión"); sessionStorage.removeItem("simpa:sesion"); setSesion(null); irA("login"); };
  const grupos = [...new Set(visibles.map((v) => v.grupo))];

  return (
    <div className="app">
      <a className="saltar" href="#contenido" onClick={(ev) => { ev.preventDefault(); document.getElementById("titulo-pagina")?.focus(); }}>Saltar al contenido</a>
      <aside className="lateral" aria-label="Navegación principal">
        <div className="marca"><svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><path d="M17 3c5 7 10 12 10 18a10 10 0 0 1-20 0c0-6 5-11 10-18z" fill="#fff" /><path d="M11 22h3l2-4 3 7 2-3h2" stroke="#0b4f6c" strokeWidth="2" fill="none" /></svg><div><b>SIMPA</b><small>Monitoreo de pérdidas de agua</small></div></div>
        <nav className="nav">
          {grupos.map((g) => <div key={g}><div className="grupo">{g}</div>{visibles.filter((v) => v.grupo === g).map((v) => <a key={v.ruta} href={`#/${v.ruta}`} aria-current={ruta === v.ruta ? "page" : undefined}><span aria-hidden="true">{v.icono}</span>{v.texto}</a>)}</div>)}
          <div className="grupo">Ayuda</div><a href="#/acerca"><span aria-hidden="true">?</span>Acerca del prototipo</a>
        </nav>
      </aside>
      <div className="principal">
        <header className="barra">
          <div className="estado" aria-live="polite"><span className="punto" style={{ background: online ? "#1e7d32" : "#b3261e" }} aria-hidden="true" />{online ? "En línea" : "Sin conexión: los cambios se guardan en el dispositivo"}</div>
          <div className="usuario"><span><b>{sesion.nombre}</b> · {NOMBRE_ROL[sesion.rol]}{sesion.cuadrilla ? ` (${sesion.cuadrilla})` : ""}</span><button className="btn sec" onClick={salir}>Cerrar sesión</button></div>
        </header>
        <main id="contenido" className="contenido">{destino}</main>
      </div>
    </div>
  );
}

function Login({ onEntrar }: { onEntrar: (s: Sesion) => void }) {
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { document.title = "Iniciar sesión · SIMPA"; }, []);
  const entrar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = get(); const ahora = Date.now();
    const clave_ = correo.trim().toLowerCase();
    const int = e.intentos[clave_] ?? { fallidos: 0, bloqueadoHasta: null };
    if (estaBloqueado(int, ahora)) { setMsg(`Acceso bloqueado temporalmente por intentos fallidos. Intente nuevamente en ${Math.ceil((int.bloqueadoHasta! - ahora) / 60000)} min.`); return; }
    const u = e.usuarios.find((x) => x.correo === clave_ && x.activo);
    const ok = !!u && u.hash === (await hashClave(clave));
    const nuevo = registrarIntento(int, ok, ahora);
    actualizar((s) => { s.intentos[clave_] = nuevo; });
    if (!ok) {
      registrar(clave_ || "(vacío)", "inicio de sesión fallido", `Intento ${nuevo.fallidos}`);
      setMsg(estaBloqueado(nuevo, ahora) ? "Acceso bloqueado por 15 minutos tras 5 intentos fallidos." : "Correo o contraseña incorrectos.");
      return;
    }
    registrar(u!.correo, "inicio de sesión", `Rol ${u!.rol}`);
    onEntrar({ correo: u!.correo, nombre: u!.nombre, rol: u!.rol, cuadrilla: u!.cuadrilla });
  };
  const demo = (c: string) => { setCorreo(c); setClave("Simpa2026!"); };
  return (
    <main className="login">
      <form className="caja" onSubmit={entrar} aria-labelledby="t-login" noValidate>
        <div className="marca" style={{ color: "var(--azul)", borderBottomColor: "var(--borde)" }}><svg width="40" height="40" viewBox="0 0 34 34" aria-hidden="true"><path d="M17 3c5 7 10 12 10 18a10 10 0 0 1-20 0c0-6 5-11 10-18z" fill="#0b4f6c" /><path d="M11 22h3l2-4 3 7 2-3h2" stroke="#fff" strokeWidth="2" fill="none" /></svg><div><b>SIMPA</b><small style={{ color: "var(--gris)" }}>Sistema Inteligente de Monitoreo de Pérdidas de Agua</small></div></div>
        <h1 id="t-login" style={{ fontSize: "1.25rem" }}>Iniciar sesión</h1>
        <p className="sub">Ingrese con su cuenta institucional.</p>
        <div className="campo"><label htmlFor="correo">Correo</label><input id="correo" type="email" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} required /></div>
        <div className="campo"><label htmlFor="clave">Contraseña</label><input id="clave" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} required /></div>
        <div aria-live="assertive">{msg && <div className="aviso mal" role="alert">{msg}</div>}</div>
        <button className="btn grande" style={{ width: "100%" }} type="submit">Ingresar</button>
        <div className="demo"><b>Cuentas de demostración</b> (contraseña <code>Simpa2026!</code>):<br />
          <button type="button" onClick={() => demo("jefe@simpa.pe")}>jefe@simpa.pe</button> · <button type="button" onClick={() => demo("operador@simpa.pe")}>operador@simpa.pe</button> · <button type="button" onClick={() => demo("cuadrilla@simpa.pe")}>cuadrilla@simpa.pe</button> · <button type="button" onClick={() => demo("gerencia@simpa.pe")}>gerencia@simpa.pe</button>
          <br /><a href="#/acerca" style={{ display: "inline-block", padding: "12px 4px", marginTop: 4 }}>Acerca del prototipo y mapa de pantallas</a></div>
      </form>
    </main>
  );
}
