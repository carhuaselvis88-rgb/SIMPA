// Reglas de negocio de las órdenes de trabajo (HU16, HU17, HU20)

export const PLAZO_HORAS = 48;
const H = 3600 * 1000;

export type Semaforo = "verde" | "ámbar" | "rojo" | "vencida";

/**
 * Regla única del semáforo, en horas RESTANTES para el vencimiento de 48 h:
 *  verde   > 24 h restantes  (equivale a < 24 h transcurridas)
 *  ámbar   de 8 a 24 h       (equivale a 24–40 h transcurridas)
 *  rojo    < 8 h             (equivale a > 40 h transcurridas)
 *  vencida ≤ 0 h
 */
export function semaforo(horasRestantes: number): Semaforo {
  if (horasRestantes <= 0) return "vencida";
  if (horasRestantes < 8) return "rojo";
  if (horasRestantes <= 24) return "ámbar";
  return "verde";
}

export function vencimiento(conocidoEn: Date): Date {
  return new Date(conocidoEn.getTime() + PLAZO_HORAS * H);
}

export function horasRestantes(conocidoEn: Date, ahora: Date): number {
  return (vencimiento(conocidoEn).getTime() - ahora.getTime()) / H;
}

export function dentroDePlazo(conocidoEn: Date, cerradoEn: Date): boolean {
  return cerradoEn.getTime() - conocidoEn.getTime() <= PLAZO_HORAS * H;
}

export interface CierreOrden {
  fotoFinal: string | null;
  tipoReparacion: string;
  caudalRecuperadoLps: number;
}

/** Valida el cierre (HU20) y devuelve los errores encontrados. */
export function validarCierre(c: CierreOrden): string[] {
  const e: string[] = [];
  if (!c.fotoFinal) e.push("Agregue la foto final de la reparación");
  if (!c.tipoReparacion.trim()) e.push("Indique el tipo de reparación");
  if (c.caudalRecuperadoLps < 0) e.push("El caudal recuperado no puede ser negativo");
  return e;
}

/** m³/día recuperados a partir del caudal recuperado en L/s. */
export function m3DiaRecuperados(lps: number): number {
  return lps * 86.4;
}
