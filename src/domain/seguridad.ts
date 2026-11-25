// Acceso por rol (HU21) y protección de datos (HU23)

export type Rol = "jefe" | "operador" | "cuadrilla" | "gerencia";

export const PERMISOS: Record<Rol, string[]> = {
  jefe: ["tablero", "mapa", "sectores", "telemetria", "balance", "nocturno", "presiones", "alertas", "pasos", "ordenes", "campo", "submedicion", "usuarios", "bitacora", "rendimiento", "operacion", "accesibilidad"],
  operador: ["tablero", "mapa", "telemetria", "balance", "nocturno", "presiones", "alertas", "ordenes", "accesibilidad"],
  cuadrilla: ["campo", "accesibilidad"],
  gerencia: ["tablero", "balance", "rendimiento", "accesibilidad"],
};

export function puedeVer(rol: Rol, modulo: string): boolean {
  return PERMISOS[rol]?.includes(modulo) ?? false;
}

export const MAX_INTENTOS = 5;
export const BLOQUEO_MIN = 15;

export interface EstadoIntentos { fallidos: number; bloqueadoHasta: number | null }

/** Registra un intento de inicio de sesión y aplica el bloqueo tras 5 fallos. */
export function registrarIntento(e: EstadoIntentos, exito: boolean, ahora: number): EstadoIntentos {
  if (e.bloqueadoHasta && ahora < e.bloqueadoHasta) return e;
  if (exito) return { fallidos: 0, bloqueadoHasta: null };
  const fallidos = e.fallidos + 1;
  return fallidos >= MAX_INTENTOS ? { fallidos, bloqueadoHasta: ahora + BLOQUEO_MIN * 60000 } : { fallidos, bloqueadoHasta: null };
}

export function estaBloqueado(e: EstadoIntentos, ahora: number): boolean {
  return !!e.bloqueadoHasta && ahora < e.bloqueadoHasta;
}

/** Datos del reportante visibles según el rol (Ley N.° 29733). */
export function datosReportante(rol: Rol, r: { nombre: string; telefono: string } | null): { nombre: string; telefono: string } | null {
  if (!r) return null;
  if (rol === "cuadrilla") return { nombre: "Reservado", telefono: "Reservado" };
  return r;
}

/** Comparación de contraseña con hash simple (solo prototipo: no reemplaza Supabase Auth). */
export async function hashClave(clave: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("simpa|" + clave));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
