/**
 * Simulación Monte Carlo del impacto operativo y económico de SaludCita AI en la consulta externa (horizonte de 12 meses).
 *
 * Cada variable incierta se modela con una distribución triangular (mínimo, más probable, máximo). En cada corrida se
 * toma un valor de cada variable y se calcula el ahorro de tiempo del personal, las asistencias recuperadas por los
 * recordatorios, los costes de operación y el ROI. Con miles de corridas se obtiene la distribución de cada resultado.
 *
 * Módulo puro (sin React ni dependencias): lo usan el panel (pestaña «Impacto y simulación») y el script que genera
 * las cifras del informe, así ambos dan exactamente los mismos resultados con la misma semilla.
 */

export interface Tri { min: number; mode: number; max: number }

export type ParamKey =
  | 'capacidad' | 'ocupacion' | 'adopcion' | 'contactos' | 'aht' | 'salario' | 'noshow' | 'rr' | 'alcance'
  | 'precio' | 'margen' | 'mensajes' | 'vps' | 'mantHoras' | 'costoTecnico' | 'implHoras';

export interface ParamInfo {
  label: string; unit: string; source: string;
  /** «medido»: dato del sistema; «fuente»: publicación citada; «supuesto»: valor del equipo, ajustable */
  kind: 'medido' | 'fuente' | 'supuesto';
  step: number; limits: [number, number];
}

export type Params = Record<ParamKey, Tri>;

/** Horas laborables al mes: jornada de 44 horas semanales (Código de Trabajo de la República Dominicana). */
export const HORAS_MES = (44 * 52) / 12;
/** Tasa de referencia del Banco Central (venta), 28 de octubre de 2026. */
export const TASA_USD = 60.52;
/** Precio de gpt-oss-120b en Groq (US$ por millón de tokens) y tokens medidos por mensaje (2 llamadas al modelo). */
export const PRECIO_TOKENS = { entrada: 0.15, salida: 0.6 };
export const TOKENS_MENSAJE = { entrada: 2 * 1028, salida: 2 * 96 };

export const PARAM_INFO: Record<ParamKey, ParamInfo> = {
  capacidad: { label: 'Horarios de consulta al mes', unit: 'horarios', kind: 'medido', step: 50, limits: [200, 20000],
    source: 'Horarios abiertos en los próximos 30 días en la base de datos del hospital simulado (9 médicos)' },
  ocupacion: { label: 'Ocupación de la agenda', unit: '%', kind: 'supuesto', step: 0.01, limits: [0.2, 1],
    source: 'Supuesto del equipo' },
  adopcion: { label: 'Gestiones hechas por el chat en lugar del teléfono', unit: '%', kind: 'supuesto', step: 0.01, limits: [0.05, 0.95],
    source: 'Supuesto del equipo; en el piloto se mide con el canal de cada reserva' },
  contactos: { label: 'Contactos por cita (reservar, cambiar, confirmar)', unit: 'contactos', kind: 'supuesto', step: 0.1, limits: [1, 4],
    source: 'Supuesto del equipo' },
  aht: { label: 'Minutos del personal por llamada de citas', unit: 'min', kind: 'fuente', step: 0.1, limits: [1, 15],
    source: 'Accenture (2013): 8.1 min de media por llamada de agenda y 3.7 min como buena práctica' },
  salario: { label: 'Salario mensual del personal de citas', unit: 'RD$', kind: 'fuente', step: 500, limits: [10000, 80000],
    source: 'Salario mínimo de empresas grandes RD$29,988 (Resolución CNS-01-2025); recepcionista RD$18,000–30,000' },
  noshow: { label: 'Inasistencia sin recordatorio', unit: '%', kind: 'fuente', step: 0.005, limits: [0.02, 0.6],
    source: 'Dantas et al. (2018): 23 % de media; 13.2 % (Oceanía) a 27.8 % (Sudamérica)' },
  rr: { label: 'Aumento de la asistencia con recordatorios (RR)', unit: '×', kind: 'fuente', step: 0.01, limits: [1, 1.5],
    source: 'Al-Turbag et al. (2026): RR 1.11 (IC 95 %: 1.05–1.19)' },
  alcance: { label: 'Pacientes del chat que ven el recordatorio', unit: '%', kind: 'supuesto', step: 0.01, limits: [0.1, 1],
    source: 'Supuesto del equipo: el aviso llega dentro del chat, no por SMS' },
  precio: { label: 'Precio de la consulta', unit: 'RD$', kind: 'medido', step: 50, limits: [500, 10000],
    source: 'Catálogo del hospital simulado: RD$1,500 a 2,800 (media RD$2,131)' },
  margen: { label: 'Parte de la tarifa que el hospital deja de perder', unit: '%', kind: 'supuesto', step: 0.01, limits: [0.05, 1],
    source: 'Supuesto del equipo: valor neto de un horario que se aprovecha en lugar de quedar vacío' },
  mensajes: { label: 'Mensajes del paciente por cita', unit: 'mensajes', kind: 'medido', step: 0.1, limits: [1, 30],
    source: 'Servidor de demostración: mediana 3, media 6.3 por conversación' },
  vps: { label: 'Servidor (VPS) al mes', unit: 'RD$', kind: 'fuente', step: 50, limits: [0, 10000],
    source: 'Contabo Cloud VPS 8 (8 núcleos, 24 GB): €11.20 a €14.00 al mes' },
  mantHoras: { label: 'Horas de mantenimiento técnico al mes', unit: 'h', kind: 'supuesto', step: 1, limits: [0, 160],
    source: 'Supuesto del equipo' },
  costoTecnico: { label: 'Salario mensual del técnico', unit: 'RD$', kind: 'supuesto', step: 1000, limits: [20000, 200000],
    source: 'Supuesto del equipo' },
  implHoras: { label: 'Horas de puesta en marcha (una vez)', unit: 'h', kind: 'supuesto', step: 10, limits: [0, 2000],
    source: 'Supuesto del equipo: instalación, datos del hospital y capacitación' },
};

export const DEFAULT_PARAMS: Params = {
  capacidad: { min: 1566, mode: 1566, max: 1566 },
  ocupacion: { min: 0.6, mode: 0.75, max: 0.9 },
  adopcion: { min: 0.2, mode: 0.4, max: 0.6 },
  contactos: { min: 1.2, mode: 1.5, max: 2 },
  aht: { min: 3.7, mode: 6, max: 8.1 },
  salario: { min: 18000, mode: 24000, max: 30000 },
  noshow: { min: 0.132, mode: 0.23, max: 0.278 },
  rr: { min: 1.05, mode: 1.11, max: 1.19 },
  alcance: { min: 0.5, mode: 0.75, max: 1 },
  precio: { min: 1500, mode: 2131, max: 2800 },
  margen: { min: 0.2, mode: 0.3, max: 0.4 },
  mensajes: { min: 3, mode: 6.3, max: 12 },
  vps: { min: 700, mode: 800, max: 1000 },
  mantHoras: { min: 8, mode: 16, max: 30 },
  costoTecnico: { min: 40000, mode: 60000, max: 90000 },
  implHoras: { min: 80, mode: 160, max: 320 },
};

export interface Outcome {
  citas: number; llamadasEvitadas: number; horasLiberadas: number; fte: number; ahorroPersonal: number;
  asistenciasExtra: number; ingresoRecuperado: number; costoIA: number; costoMensual: number;
  netoConservador: number; netoAmpliado: number; inversion: number; roiConservador: number; roiAmpliado: number;
  /** Meses para recuperar la inversión (Infinity si el beneficio mensual no es positivo) */
  paybackAmpliado: number;
}

/** Resultado de una corrida con valores concretos de cada variable. */
export function evaluate(v: Record<ParamKey, number>): Outcome {
  const citas = v.capacidad * v.ocupacion;
  const llamadasEvitadas = citas * v.contactos * v.adopcion;
  const horasLiberadas = (llamadasEvitadas * v.aht) / 60;
  const ahorroPersonal = horasLiberadas * (v.salario / HORAS_MES);
  const asistenciaBase = 1 - v.noshow;
  const asistenciasExtra = citas * v.adopcion * v.alcance * (Math.min(1, asistenciaBase * v.rr) - asistenciaBase);
  const ingresoRecuperado = asistenciasExtra * v.precio * v.margen;
  const usdMensaje = (TOKENS_MENSAJE.entrada * PRECIO_TOKENS.entrada + TOKENS_MENSAJE.salida * PRECIO_TOKENS.salida) / 1e6;
  const costoIA = citas * v.adopcion * v.mensajes * usdMensaje * TASA_USD;
  const costoHoraTecnico = v.costoTecnico / HORAS_MES;
  const costoMensual = v.vps + costoIA + v.mantHoras * costoHoraTecnico;
  const inversion = v.implHoras * costoHoraTecnico;
  const netoConservador = ahorroPersonal - costoMensual;
  const netoAmpliado = ahorroPersonal + ingresoRecuperado - costoMensual;
  const costo12 = inversion + 12 * costoMensual;
  return {
    citas, llamadasEvitadas, horasLiberadas, fte: horasLiberadas / HORAS_MES, ahorroPersonal, asistenciasExtra, ingresoRecuperado,
    costoIA, costoMensual, netoConservador, netoAmpliado, inversion,
    roiConservador: (12 * ahorroPersonal - costo12) / costo12,
    roiAmpliado: (12 * (ahorroPersonal + ingresoRecuperado) - costo12) / costo12,
    paybackAmpliado: netoAmpliado > 0 ? inversion / netoAmpliado : Infinity,
  };
}

/** Generador pseudoaleatorio con semilla (mulberry32): la misma semilla reproduce las mismas corridas. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Muestra de una triangular por la inversa de su función de distribución. */
export function sampleTri({ min, mode, max }: Tri, u: number): number {
  if (max <= min) return min;
  const f = (mode - min) / (max - min);
  return u < f ? min + Math.sqrt(u * (max - min) * (mode - min)) : max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

const KEYS = Object.keys(DEFAULT_PARAMS) as ParamKey[];
const modes = (p: Params) => Object.fromEntries(KEYS.map((k) => [k, p[k].mode])) as Record<ParamKey, number>;

export interface Stats { mean: number; p5: number; p50: number; p95: number }
export interface SimResult {
  runs: number; seed: number; outcomes: Outcome[];
  stats: Record<keyof Outcome, Stats>;
  /** Probabilidad de que el ROI a 12 meses sea positivo */
  probRoiConservador: number; probRoiAmpliado: number;
  /** Probabilidad de recuperar la inversión en 12 meses o menos */
  probPayback12: number;
  base: Outcome;
}

function quantile(sorted: number[], q: number) {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i); const hi = Math.ceil(i);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
}

export function simulate(p: Params, runs = 10000, seed = 2026): SimResult {
  const r = rng(seed);
  const outcomes: Outcome[] = [];
  for (let i = 0; i < runs; i++) {
    const v = Object.fromEntries(KEYS.map((k) => [k, sampleTri(p[k], r())])) as Record<ParamKey, number>;
    outcomes.push(evaluate(v));
  }
  const fields = Object.keys(outcomes[0]!) as (keyof Outcome)[];
  const stats = Object.fromEntries(fields.map((f) => {
    const xs = outcomes.map((o) => o[f]).filter(Number.isFinite).sort((a, b) => a - b);
    return [f, { mean: xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1), p5: quantile(xs, 0.05), p50: quantile(xs, 0.5), p95: quantile(xs, 0.95) }];
  })) as Record<keyof Outcome, Stats>;
  const share = (pred: (o: Outcome) => boolean) => outcomes.filter(pred).length / runs;
  return {
    runs, seed, outcomes, stats, base: evaluate(modes(p)),
    probRoiConservador: share((o) => o.roiConservador > 0),
    probRoiAmpliado: share((o) => o.roiAmpliado > 0),
    probPayback12: share((o) => o.paybackAmpliado <= 12),
  };
}

/** Histograma de un resultado: límites de cada barra y número de corridas. */
export function histogram(values: number[], bins = 24): { from: number; to: number; count: number }[] {
  const xs = values.filter(Number.isFinite);
  const lo = Math.min(...xs); const hi = Math.max(...xs);
  const w = (hi - lo) / bins || 1;
  const out = Array.from({ length: bins }, (_, i) => ({ from: lo + i * w, to: lo + (i + 1) * w, count: 0 }));
  for (const x of xs) out[Math.min(bins - 1, Math.floor((x - lo) / w))]!.count++;
  return out;
}

/**
 * Sensibilidad («tornado»): cada variable se lleva a su mínimo y a su máximo con las demás en su valor más probable.
 * Devuelve el beneficio neto mensual (ampliado) en ambos extremos, ordenado por la amplitud del efecto.
 */
export function tornado(p: Params, metric: (o: Outcome) => number = (o) => o.netoAmpliado) {
  const base = modes(p);
  return KEYS.filter((k) => p[k].max > p[k].min).map((k) => {
    const low = metric(evaluate({ ...base, [k]: p[k].min }));
    const high = metric(evaluate({ ...base, [k]: p[k].max }));
    return { key: k, label: PARAM_INFO[k].label, low, high, swing: Math.abs(high - low) };
  }).sort((a, b) => b.swing - a.swing);
}
