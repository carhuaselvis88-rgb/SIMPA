// Repositorio local: persiste en localStorage (en producción se reemplaza por Supabase).
import { SECTORES, TRAMOS, PUNTOS, generarSerie, ESCENARIO_FUGA, type Sector, type Tramo, type LecturaSerie, type Pos } from "./gemelo";
import { evaluarMNF, caudalMinimoNocturno, prioridadPorVolumen, tramosProbables, type Prioridad } from "../domain/alertas";
import { perdidasRealesNocturnas } from "../domain/hidraulica";
import { vencimiento } from "../domain/ordenes";
import type { Rol, EstadoIntentos } from "../domain/seguridad";

export interface Usuario { id: string; nombre: string; correo: string; rol: Rol; cuadrilla?: string; activo: boolean; hash: string }
export interface Alerta { id: string; sector: string; tipo: "posible fuga" | "caída de presión" | "sobrepresión"; prioridad: Prioridad; m3Dia: number; creada: number; estado: "abierta" | "en orden" | "descartada"; motivo?: string; tramos?: { tramo: string; probabilidad: number }[]; detalle: string }
export interface Orden { id: string; alerta?: string; origen: "alerta" | "ciudadano" | "contratista"; sector: string; tramo?: string; pos: Pos; conocida: number; vence: number; cuadrilla?: string; estado: "registrada" | "asignada" | "en atención" | "cerrada"; reportante?: { nombre: string; telefono: string; consentimiento: boolean }; cierre?: { ts: number; tipo: string; lps: number; foto: string; enPlazo: boolean; materiales?: string }; descripcion: string }
export interface Hallazgo { id: string; orden: string; metodo: "acústico" | "térmico" | "visual"; tipo: string; pos: Pos; precision: number; fotos: string[]; ts: number; sincronizado: boolean }
export interface Evento { id: string; ts: number; usuario: string; accion: string; detalle: string }
export interface PruebaPasos { id: string; sector: string; orden: string[]; pasos: { valvula: string; tramo: string; qAntes: number; qDespues: number; ts: number }[]; estado: "planificada" | "en curso" | "finalizada" }

export interface Estado {
  version: number;
  sectores: Sector[];
  tramos: Tramo[];
  usuarios: Usuario[];
  alertas: Alerta[];
  ordenes: Orden[];
  hallazgos: Hallazgo[];
  bitacora: Evento[];
  lecturasExtra: LecturaSerie[];
  rechazos: { ts: number; punto: string; motivo: string }[];
  facturado: Record<string, number | null>; // periodo "2026-10" -> m³ del mes
  intentos: Record<string, EstadoIntentos>;
  pruebas: PruebaPasos[];
  cola: { tipo: string; payload: unknown; ts: number }[];
  ajustes: { altoContraste: boolean; textoGrande: boolean };
  ultimoRespaldo?: number;
}

const KEY = "simpa:v1";
const H = 3600 * 1000;

// Hash precalculado de "Simpa2026!" (SHA-256 con sal "simpa|")
export const CLAVE_DEMO = "Simpa2026!";
const HASH_DEMO = "pendiente";

function semilla(): Estado {
  const ahora = Date.now();
  const serie = generarSerie(PUNTOS[0], ahora - 36 * H, ahora);
  const anoche = serie.filter((l) => l.ts > ahora - 30 * H).map((l) => ({ ts: new Date(l.ts), valor: l.valor }));
  const qmn = caudalMinimoNocturno(anoche) ?? 12.5;
  const ev = evaluarMNF(qmn, 9.8);
  const m3 = perdidasRealesNocturnas({ qmn, usoLegitimo: 1.2, fnd: 21 }) - perdidasRealesNocturnas({ qmn: 9.8, usoLegitimo: 1.2, fnd: 21 });
  const tramos = tramosProbables([{ punto: "P-SP01-03", caidaPct: 30 }, { punto: "P-SP01-02", caidaPct: 4 }, { punto: "P-SP01-04", caidaPct: 4 }], Object.fromEntries(PUNTOS.map((p) => [p.id, p.tramos])));
  const alertas: Alerta[] = [
    { id: "AL-0001", sector: "SP-01", tipo: "posible fuga", prioridad: prioridadPorVolumen(Math.max(m3, 120)), m3Dia: Math.round(Math.max(m3, 0)), creada: ahora - 5 * H, estado: "abierta", tramos: tramos.map((t) => ({ tramo: t.tramo, probabilidad: t.probabilidad })), detalle: `Caudal mínimo nocturno ${qmn.toFixed(1)} L/s vs línea base 9,8 L/s (${ev.variacionPct >= 0 ? "+" : ""}${ev.variacionPct.toFixed(1)} %)` },
    { id: "AL-0002", sector: "SP-01", tipo: "caída de presión", prioridad: "alta", m3Dia: 0, creada: ahora - 28 * H, estado: "abierta", detalle: "P-SP01-03 cayó 30 % fuera de la banda μ ± 3σ" },
    { id: "AL-0003", sector: "SP-02", tipo: "sobrepresión", prioridad: "baja", m3Dia: 0, creada: ahora - 50 * H, estado: "descartada", motivo: "Maniobra programada de válvula reductora", detalle: "Q-SP02-ENT: presión 58 m a las 03:00" },
  ];
  const ordenes: Orden[] = [
    { id: "OT-0140", origen: "ciudadano", sector: "SP-01", pos: [-13.5262, -71.9702], conocida: ahora - 46 * H, vence: vencimiento(new Date(ahora - 46 * H)).getTime(), cuadrilla: "Cuadrilla 1", estado: "en atención", reportante: { nombre: "María Quispe", telefono: "984 512 377", consentimiento: true }, descripcion: "Vecino reporta agua aflorando en la vereda (Av. Garcilaso 812)" },
    { id: "OT-0141", origen: "contratista", sector: "SP-02", pos: [-13.5369, -71.9661], conocida: ahora - 30 * H, vence: vencimiento(new Date(ahora - 30 * H)).getTime(), cuadrilla: "Cuadrilla 2", estado: "asignada", descripcion: "Contratista de obra rompió conexión domiciliaria" },
    { id: "OT-0142", origen: "ciudadano", sector: "SP-01", pos: [-13.5301, -71.9648], conocida: ahora - 10 * H, vence: vencimiento(new Date(ahora - 10 * H)).getTime(), estado: "registrada", reportante: { nombre: "Jorge Huallpa", telefono: "974 220 118", consentimiento: true }, descripcion: "Humedad constante en la pista frente al mercado" },
    { id: "OT-0139", origen: "alerta", sector: "SP-01", tramo: "T-07", pos: [-13.5326, -71.9645], conocida: ahora - 70 * H, vence: vencimiento(new Date(ahora - 70 * H)).getTime(), cuadrilla: "Cuadrilla 1", estado: "cerrada", cierre: { ts: ahora - 31 * H, tipo: "Cambio de abrazadera", lps: 1.5, foto: "cierre-ot0139.jpg", enPlazo: true, materiales: "abrazadera de reparación 110 mm" }, descripcion: "Fuga detectada por caudal nocturno (alerta histórica)" },
  ];
  return {
    version: 1,
    sectores: SECTORES,
    tramos: TRAMOS,
    usuarios: [
      { id: "u1", nombre: "Jefe de Control de Pérdidas", correo: "jefe@simpa.pe", rol: "jefe", activo: true, hash: HASH_DEMO },
      { id: "u2", nombre: "Operador de Monitoreo", correo: "operador@simpa.pe", rol: "operador", activo: true, hash: HASH_DEMO },
      { id: "u3", nombre: "Técnico de Cuadrilla 1", correo: "cuadrilla@simpa.pe", rol: "cuadrilla", cuadrilla: "Cuadrilla 1", activo: true, hash: HASH_DEMO },
      { id: "u4", nombre: "Gerencia de Operaciones", correo: "gerencia@simpa.pe", rol: "gerencia", activo: true, hash: HASH_DEMO },
    ],
    alertas, ordenes,
    hallazgos: [{ id: "HZ-0031", orden: "OT-0139", metodo: "acústico", tipo: "Fuga en unión de tubería", pos: [-13.5326, -71.9645], precision: 4, fotos: ["hallazgo-ot0139.jpg"], ts: ahora - 40 * H, sincronizado: true }],
    bitacora: [{ id: "E-1", ts: ahora - 31 * H, usuario: "cuadrilla@simpa.pe", accion: "cerrar orden", detalle: "OT-0139 cerrada dentro del plazo (39 h)" }],
    lecturasExtra: [], rechazos: [],
    facturado: { "2026-09": 1311 * 30, "2026-10": 1311 * 31, "2026-11": null },
    intentos: {}, pruebas: [], cola: [],
    ajustes: { altoContraste: false, textoGrande: false },
  };
}

type Listener = () => void;
let estado: Estado;
const listeners = new Set<Listener>();

export function cargar(): Estado {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const e = JSON.parse(raw) as Estado; if (e.version === 1) { estado = e; return estado; } }
  } catch { /* almacenamiento no disponible */ }
  estado = semilla();
  guardar();
  return estado;
}

export function guardar() {
  estado = { ...estado }; // nueva referencia: React vuelve a pintar a los suscriptores
  try { localStorage.setItem(KEY, JSON.stringify(estado)); } catch { /* sin almacenamiento: se mantiene en memoria */ }
  listeners.forEach((l) => l());
}

export function get(): Estado { return estado ?? cargar(); }
export function suscribir(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; }

export function actualizar(fn: (e: Estado) => void) { fn(get()); guardar(); }

export function reiniciarDemo() { try { localStorage.removeItem(KEY); } catch { /* */ } estado = semilla(); guardar(); }

export function registrar(usuario: string, accion: string, detalle: string) {
  actualizar((e) => { e.bitacora.unshift({ id: "E-" + (e.bitacora.length + 1), ts: Date.now(), usuario, accion, detalle }); });
}

export function nuevoId(prefijo: string, lista: { id: string }[]) {
  const n = Math.max(0, ...lista.map((x) => Number(x.id.replace(/\D/g, "")) || 0)) + 1;
  return `${prefijo}-${String(n).padStart(4, "0")}`;
}

export function fijarHash(h: string) { actualizar((e) => { e.usuarios.forEach((u) => { if (u.hash === HASH_DEMO) u.hash = h; }); }); }

export const ESCENARIO = ESCENARIO_FUGA;
