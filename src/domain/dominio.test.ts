import { describe, it, expect } from "vitest";
import { perdidasRealesNocturnas, anfPct, uarl, ili, categoriaILI, balanceIWA } from "./hidraulica";
import { caudalMinimoNocturno, evaluarMNF, bandaEsperada, fueraDeBanda, prioridadPorVolumen, ordenarAlertas, tramosProbables, resultadoPruebaPasos } from "./alertas";
import { semaforo, horasRestantes, vencimiento, dentroDePlazo, validarCierre, m3DiaRecuperados } from "./ordenes";
import { validarLectura, parsearCSV, claveLectura, poligonoValido, importarSectores, validarTramo, validarHallazgo, puntajeSubmedicion } from "./validaciones";
import { puedeVer, registrarIntento, estaBloqueado, datosReportante, MAX_INTENTOS } from "./seguridad";

describe("HU08–HU11 · Cálculos hidráulicos", () => {
  it("pérdidas reales del sector piloto ≈ 650 m³/día", () => {
    expect(perdidasRealesNocturnas({ qmn: 9.8, usoLegitimo: 1.2, fnd: 21 })).toBeCloseTo(650.16, 2);
  });
  it("rechaza uso legítimo mayor que el caudal nocturno", () => {
    expect(() => perdidasRealesNocturnas({ qmn: 1, usoLegitimo: 2, fnd: 21 })).toThrow("uso legítimo mayor");
  });
  it("rechaza caudales negativos y factor fuera de rango", () => {
    expect(() => perdidasRealesNocturnas({ qmn: -1, usoLegitimo: 0, fnd: 21 })).toThrow();
    expect(() => perdidasRealesNocturnas({ qmn: 5, usoLegitimo: 1, fnd: 30 })).toThrow("factor");
  });
  it("ANF del escenario base = 39,31 %", () => {
    expect(anfPct(2160, 1311)).toBeCloseTo(39.31, 2);
    expect(() => anfPct(0, 0)).toThrow();
    expect(() => anfPct(100, 120)).toThrow();
  });
  it("UARL ≈ 78,5 m³/día e ILI ≈ 8,3 (categoría C)", () => {
    const u = uarl({ lm: 18, nc: 2400, lp: 0, presion: 35 });
    expect(u).toBeCloseTo(78.54, 2);
    const v = ili(650.16, u);
    expect(v).toBeCloseTo(8.28, 2);
    expect(categoriaILI(v).cat).toBe("C");
    expect(categoriaILI(2).cat).toBe("A");
    expect(categoriaILI(5).cat).toBe("B");
    expect(categoriaILI(20).cat).toBe("D");
    expect(() => ili(10, 0)).toThrow();
    expect(() => uarl({ lm: -1, nc: 0, lp: 0, presion: 0 })).toThrow();
  });
  it("balance IWA separa reales, aparentes y autorizado no facturado", () => {
    const b = balanceIWA({ ingresadoM3: 2160, facturadoM3: 1311, autorizadoNoFacturadoM3: 43, perdidasRealesM3: 650 });
    expect(b.anfM3).toBe(849);
    expect(b.realesM3).toBe(650);
    expect(b.aparentesM3).toBe(156);
    expect(b.anfPct).toBeCloseTo(39.31, 2);
  });
  it("balance sin volumen facturado muestra el mensaje", () => {
    expect(() => balanceIWA({ ingresadoM3: 2160, facturadoM3: null, autorizadoNoFacturadoM3: 0, perdidasRealesM3: 0 })).toThrow("Falta volumen facturado");
  });
});

describe("HU11–HU15 · Detección y aislamiento", () => {
  const dia = (h: number, m: number, v: number) => ({ ts: new Date(2026, 9, 10, h, m), valor: v });
  it("caudal mínimo nocturno entre 02:00 y 04:00", () => {
    expect(caudalMinimoNocturno([dia(1, 45, 5), dia(2, 0, 10.4), dia(3, 15, 9.8), dia(4, 0, 3)])).toBe(9.8);
    expect(caudalMinimoNocturno([dia(12, 0, 20)])).toBeNull();
  });
  it("alerta si supera la línea base en más de 20 % (12,5 vs 9,8)", () => {
    const r = evaluarMNF(12.5, 9.8);
    expect(r.alerta).toBe(true);
    expect(r.variacionPct).toBeCloseTo(27.55, 1);
  });
  it("sin alerta con variación normal (10,3 vs 9,8)", () => {
    expect(evaluarMNF(10.3, 9.8).alerta).toBe(false);
    expect(() => evaluarMNF(1, 0)).toThrow();
  });
  it("banda μ ± 3σ detecta una caída de presión de 30 %", () => {
    const serie = [35, 35.4, 34.8, 35.1, 34.9, 35.2, 35, 34.7];
    const b = bandaEsperada(serie);
    expect(fueraDeBanda(35 * 0.7, b)).toBe(true);
    expect(fueraDeBanda(35.1, b)).toBe(false);
    expect(() => bandaEsperada([1])).toThrow();
  });
  it("prioriza por volumen y ordena alertas", () => {
    expect(prioridadPorVolumen(250)).toBe("crítica");
    expect(prioridadPorVolumen(120)).toBe("alta");
    expect(prioridadPorVolumen(40)).toBe("media");
    expect(prioridadPorVolumen(5)).toBe("baja");
    const o = ordenarAlertas([{ id: 1, prioridad: "media" as const, m3Dia: 50 }, { id: 2, prioridad: "crítica" as const, m3Dia: 210 }, { id: 3, prioridad: "media" as const, m3Dia: 80 }]);
    expect(o.map((x) => x.id)).toEqual([2, 3, 1]);
  });
  it("tramos probables: el tramo con más caída queda primero", () => {
    const r = tramosProbables([{ punto: "P1", caidaPct: 30 }, { punto: "P2", caidaPct: 10 }], { P1: ["T-12", "T-13"], P2: ["T-12", "T-07"] });
    expect(r[0].tramo).toBe("T-12");
    expect(r.length).toBe(3);
    expect(r.reduce((a, b) => a + b.probabilidad, 0)).toBeCloseTo(1, 5);
  });
  it("prueba de pasos identifica el tramo con mayor caída", () => {
    const r = resultadoPruebaPasos([{ valvula: "V-1", tramo: "T-03", qAntes: 25, qDespues: 24 }, { valvula: "V-3", tramo: "T-12", qAntes: 24, qDespues: 21.2 }]);
    expect(r.tramo).toBe("T-12");
    expect(() => resultadoPruebaPasos([])).toThrow();
  });
});

describe("HU16, HU17, HU20 · Órdenes y semáforo de 48 h", () => {
  it("regla única del semáforo en horas restantes", () => {
    expect(semaforo(30)).toBe("verde");
    expect(semaforo(24.01)).toBe("verde");
    expect(semaforo(24)).toBe("ámbar");
    expect(semaforo(10)).toBe("ámbar");
    expect(semaforo(8)).toBe("ámbar");
    expect(semaforo(6)).toBe("rojo");
    expect(semaforo(0)).toBe("vencida");
  });
  it("las marcas coinciden con 24 h y 40 h transcurridas", () => {
    const c = new Date("2026-11-20T08:00:00");
    expect(semaforo(horasRestantes(c, new Date("2026-11-21T07:00:00")))).toBe("verde"); // 23 h transcurridas
    expect(semaforo(horasRestantes(c, new Date("2026-11-21T09:00:00")))).toBe("ámbar"); // 25 h
    expect(semaforo(horasRestantes(c, new Date("2026-11-22T00:00:00")))).toBe("ámbar"); // 40 h
    expect(semaforo(horasRestantes(c, new Date("2026-11-22T01:00:00")))).toBe("rojo"); // 41 h
  });
  it("vencimiento a 48 h y cumplimiento del plazo", () => {
    const c = new Date("2026-11-20T08:00:00");
    expect(vencimiento(c).toISOString()).toBe(new Date("2026-11-22T08:00:00").toISOString());
    expect(dentroDePlazo(c, new Date("2026-11-22T05:00:00"))).toBe(true);
    expect(dentroDePlazo(c, new Date("2026-11-22T09:00:00"))).toBe(false);
  });
  it("cierre exige foto y tipo de reparación", () => {
    expect(validarCierre({ fotoFinal: null, tipoReparacion: "", caudalRecuperadoLps: 1 })).toHaveLength(2);
    expect(validarCierre({ fotoFinal: "f.jpg", tipoReparacion: "Abrazadera", caudalRecuperadoLps: -1 })).toHaveLength(1);
    expect(validarCierre({ fotoFinal: "f.jpg", tipoReparacion: "Abrazadera", caudalRecuperadoLps: 1.5 })).toHaveLength(0);
    expect(m3DiaRecuperados(1.5)).toBeCloseTo(129.6, 5);
  });
});

describe("HU02–HU07, HU10, HU19 · Validaciones de entrada", () => {
  it("lecturas válidas e inválidas", () => {
    expect(validarLectura({ punto: "Q-SP01-ENT", ts: "2026-11-20T03:00:00Z", valor: 24.8, tipo: "caudal" })).toEqual([]);
    expect(validarLectura({ punto: "P-01", ts: "x", valor: -2, tipo: "presion" })).toEqual(["marca de tiempo inválida", "presión negativa"]);
    expect(validarLectura({ punto: "", ts: "2026-11-20T03:00:00Z", valor: 200, tipo: "presion" })).toEqual(["punto requerido", "presión fuera de rango (> 150 m)"]);
    expect(validarLectura({ punto: "Q", ts: "2026-11-20T03:00:00Z", valor: 900, tipo: "caudal" })).toHaveLength(1);
    expect(validarLectura({ punto: "Q", ts: "2026-11-20T03:00:00Z", tipo: "caudal" })).toEqual(["valor numérico requerido"]);
  });
  it("CSV: filas válidas, con error y cabecera incorrecta", () => {
    const r = parsearCSV("punto,fecha_hora,valor,tipo\nQ1,2026-11-20T00:00:00Z,24.1,caudal\nQ1,fecha-mala,24,caudal\nP1,2026-11-20T00:00:00Z,33,presion\nP1,2026-11-20T00:15:00Z,33,otro");
    expect(r.validas).toHaveLength(2);
    expect(r.errores.map((e) => e.fila)).toEqual([3, 5]);
    expect(parsearCSV("a,b\n1,2").errores[0].error).toMatch("cabecera");
    expect(parsearCSV("").errores[0].error).toBe("archivo vacío");
    expect(claveLectura({ punto: "Q1", ts: "2026-11-20T00:00:00Z" })).toBe("Q1|2026-11-20T00:00:00.000Z");
  });
  it("GeoJSON: polígono válido, abierto y autointersectado", () => {
    const ok: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
    const lazo: [number, number][] = [[0, 0], [1, 1], [1, 0], [0, 1], [0, 0]];
    expect(poligonoValido(ok)).toBeNull();
    expect(poligonoValido(lazo)).toBe("el polígono se cruza a sí mismo");
    expect(poligonoValido([[0, 0], [1, 0], [1, 1], [0, 1]])).toBe("el polígono no está cerrado");
    expect(poligonoValido([[0, 0], [1, 0], [0, 0]])).toMatch("al menos 4");
    const fc = (an: [number, number][][]) => ({ type: "FeatureCollection", features: an.map((a, i) => ({ properties: { codigo: "S" + i, nombre: "N" + i }, geometry: { type: "Polygon", coordinates: [a] } })) });
    const r1 = importarSectores(fc([ok, ok, ok]));
    expect(r1.ok && r1.sectores.length).toBe(3);
    const r2 = importarSectores(fc([ok, lazo]));
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.fila).toBe(2);
    expect(importarSectores({}).ok).toBe(false);
    expect(importarSectores({ type: "FeatureCollection", features: [{ geometry: { type: "Point" } }] }).ok).toBe(false);
    expect(importarSectores({ type: "FeatureCollection", features: [{ properties: {}, geometry: { type: "Polygon", coordinates: [ok] } }] }).ok).toBe(false);
  });
  it("catastro: año y diámetro fuera de rango", () => {
    expect(validarTramo({ material: "PVC", diametroMm: 160, anio: 1998 }, 2026)).toEqual({});
    const e = validarTramo({ material: "", diametroMm: 5, anio: 2030 }, 2026);
    expect(Object.keys(e).sort()).toEqual(["anio", "diametroMm", "material"]);
  });
  it("hallazgo sin foto no se guarda", () => {
    expect(validarHallazgo({ metodo: "acústico", tipo: "Fuga en unión", lat: -13.5, lng: -71.9, fotos: 0 })).toEqual(["Agregue al menos una foto"]);
    expect(validarHallazgo({ metodo: "x", tipo: "", lat: null, lng: null, fotos: 1 })).toHaveLength(3);
  });
  it("submedición: consumo cero, plano y en caída", () => {
    expect(puntajeSubmedicion([12, 12, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1], 2010, 2026).puntaje).toBeGreaterThanOrEqual(75);
    expect(puntajeSubmedicion([8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8], 2023, 2026).motivos).toEqual(["consumo plano"]);
    expect(puntajeSubmedicion([15, 14, 16, 15, 17, 16, 15, 14, 16, 15, 17, 16], 2024, 2026).puntaje).toBe(0);
  });
});

describe("HU21, HU23 · Acceso y protección de datos", () => {
  it("permisos por rol", () => {
    expect(puedeVer("operador", "ordenes")).toBe(true);
    expect(puedeVer("cuadrilla", "usuarios")).toBe(false);
    expect(puedeVer("gerencia", "tablero")).toBe(true);
  });
  it("bloqueo tras 5 intentos fallidos por 15 minutos", () => {
    let e = { fallidos: 0, bloqueadoHasta: null as number | null };
    for (let i = 0; i < MAX_INTENTOS; i++) e = registrarIntento(e, false, 1000);
    expect(estaBloqueado(e, 1000)).toBe(true);
    expect(estaBloqueado(e, 1000 + 15 * 60000 + 1)).toBe(false);
    expect(registrarIntento(e, true, 2000)).toBe(e);
    expect(registrarIntento({ fallidos: 2, bloqueadoHasta: null }, true, 1)).toEqual({ fallidos: 0, bloqueadoHasta: null });
  });
  it("la cuadrilla no ve los datos del reportante", () => {
    expect(datosReportante("cuadrilla", { nombre: "Ana", telefono: "984000000" })?.telefono).toBe("Reservado");
    expect(datosReportante("operador", { nombre: "Ana", telefono: "984000000" })?.nombre).toBe("Ana");
    expect(datosReportante("jefe", null)).toBeNull();
  });
});
