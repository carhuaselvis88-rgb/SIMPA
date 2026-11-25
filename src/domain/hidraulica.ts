// Cálculos hidráulicos del balance IWA (Lambert e Hirner, 2000)

/** Pérdidas reales estimadas por caudal mínimo nocturno, en m³/día. */
export function perdidasRealesNocturnas(p: { qmn: number; usoLegitimo: number; fnd: number }): number {
  const { qmn, usoLegitimo, fnd } = p;
  if (qmn < 0 || usoLegitimo < 0) throw new Error("caudales negativos");
  if (usoLegitimo > qmn) throw new Error("uso legítimo mayor que el caudal nocturno");
  if (fnd <= 0 || fnd > 24) throw new Error("factor noche-día fuera de rango");
  // L/s × 3,6 = m³/h; × horas equivalentes del factor noche-día
  return (qmn - usoLegitimo) * 3.6 * fnd;
}

/** Porcentaje de agua no facturada. */
export function anfPct(ingresadoM3: number, facturadoM3: number): number {
  if (ingresadoM3 <= 0) throw new Error("volumen ingresado debe ser positivo");
  if (facturadoM3 < 0 || facturadoM3 > ingresadoM3) throw new Error("volumen facturado inválido");
  return ((ingresadoM3 - facturadoM3) / ingresadoM3) * 100;
}

/** Pérdidas reales anuales inevitables (UARL), en m³/día. Lm en km, Lp en km, P en m. */
export function uarl(p: { lm: number; nc: number; lp: number; presion: number }): number {
  const { lm, nc, lp, presion } = p;
  if ([lm, nc, lp, presion].some((v) => v < 0)) throw new Error("parámetros negativos");
  // (18·Lm + 0,8·Nc + 25·Lp) · P en litros/día → m³/día
  return ((18 * lm + 0.8 * nc + 25 * lp) * presion) / 1000;
}

/** Índice de fugas en infraestructura. */
export function ili(perdidasReales: number, uarlM3: number): number {
  if (uarlM3 <= 0) throw new Error("UARL debe ser positivo");
  return perdidasReales / uarlM3;
}

/** Categoría del Banco Mundial para países en desarrollo según ILI. */
export function categoriaILI(valor: number): { cat: "A" | "B" | "C" | "D"; texto: string } {
  if (valor < 4) return { cat: "A", texto: "Desempeño bueno: reducir más puede no ser rentable" };
  if (valor < 8) return { cat: "B", texto: "Potencial de mejora: gestión de presiones y control activo" };
  if (valor < 16) return { cat: "C", texto: "Desempeño deficiente: se requiere control activo de fugas" };
  return { cat: "D", texto: "Uso muy ineficiente de los recursos: acción urgente" };
}

export interface BalanceEntrada {
  ingresadoM3: number;
  facturadoM3: number | null;
  autorizadoNoFacturadoM3: number;
  perdidasRealesM3: number;
}

export interface BalanceResultado {
  ingresadoM3: number;
  facturadoM3: number;
  anfM3: number;
  anfPct: number;
  realesM3: number;
  aparentesM3: number;
  autorizadoNoFacturadoM3: number;
}

/** Balance hídrico IWA simplificado del periodo. */
export function balanceIWA(e: BalanceEntrada): BalanceResultado {
  if (e.facturadoM3 === null) throw new Error("Falta volumen facturado");
  const anfM3 = e.ingresadoM3 - e.facturadoM3;
  const reales = Math.min(e.perdidasRealesM3, anfM3 - e.autorizadoNoFacturadoM3);
  const aparentes = Math.max(0, anfM3 - e.autorizadoNoFacturadoM3 - reales);
  return {
    ingresadoM3: e.ingresadoM3,
    facturadoM3: e.facturadoM3,
    anfM3,
    anfPct: anfPct(e.ingresadoM3, e.facturadoM3),
    realesM3: reales,
    aparentesM3: aparentes,
    autorizadoNoFacturadoM3: e.autorizadoNoFacturadoM3,
  };
}
