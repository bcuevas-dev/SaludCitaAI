// Corre la simulación Monte Carlo del panel (src/sim/montecarlo.ts) con la misma semilla y escribe sus resultados en JSON:
// los dos escenarios de tamaño, la sensibilidad y los supuestos. Son las cifras que cita el informe.
//
// Uso (desde apps/admin-panel): node scripts/simulacion.ts [archivo-de-salida.json]

import { writeFileSync } from 'node:fs';
import { DEFAULT_PARAMS, PARAM_INFO, type ParamKey, type Params, evaluate, histogram, simulate, tornado } from '../src/sim/montecarlo.ts';

const RUNS = 10000;
const scenario = (capacidad: number): Params => ({ ...DEFAULT_PARAMS, capacidad: { min: capacidad, mode: capacidad, max: capacidad } });

const out = Object.fromEntries([['simulado', 1566], ['mediano', 5000], ['grande', 12000]].map(([id, cap]) => {
  const p = scenario(cap as number);
  const r = simulate(p, RUNS);
  return [id, {
    capacidad: cap, runs: r.runs, seed: r.seed, stats: r.stats, base: r.base,
    probRoiConservador: r.probRoiConservador, probRoiAmpliado: r.probRoiAmpliado, probPayback12: r.probPayback12,
    tornado: tornado(p), histograma: histogram(r.outcomes.map((o) => o.netoAmpliado), 24),
  }];
}));

/** Valor de una variable en el que el ROI a 12 meses solo con ahorro de personal es cero (demás variables en su valor más probable). */
function equilibrio(k: ParamKey, lo: number, hi: number): number | null {
  const modes = Object.fromEntries(Object.entries(DEFAULT_PARAMS).map(([key, t]) => [key, t.mode])) as Record<ParamKey, number>;
  const roi = (x: number) => evaluate({ ...modes, [k]: x }).roiConservador;
  if (Math.sign(roi(lo)) === Math.sign(roi(hi))) return null;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (Math.sign(roi(mid)) === Math.sign(roi(lo))) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
const equilibrios = { adopcion: equilibrio('adopcion', 0.01, 1), capacidad: equilibrio('capacidad', 100, 20000) };

const json = JSON.stringify({ params: DEFAULT_PARAMS, info: PARAM_INFO, escenarios: out, equilibrios }, null, 1);
if (process.argv[2]) writeFileSync(process.argv[2], json);
else process.stdout.write(json);
