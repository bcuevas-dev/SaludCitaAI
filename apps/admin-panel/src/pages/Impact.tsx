import { useMemo, useState } from 'react';
import { type Conversation, type Envelope, type Summary, qs } from '../api';
import { ChartView, cssVar, useTheme } from '../components/Chart';
import { type StatsFilter, filterQuery, filterValid } from '../components/Filters';
import { Async, Badge, Card, Definition, Kpi, Updated } from '../components/ui';
import { n, pct } from '../format';
import { useApi } from '../hooks';
import { EVALUACION, type ModelEval } from '../sim/evaluacion';
import {
  DEFAULT_PARAMS, HORAS_MES, PARAM_INFO, type ParamKey, type Params, type SimResult, histogram, simulate, tornado,
} from '../sim/montecarlo';

/**
 * Estadísticas › Impacto y simulación: cuadro de mando para la dirección. Reúne (1) indicadores en vivo de la operación,
 * (2) la precisión medida del modelo y (3) la simulación Monte Carlo del impacto económico con supuestos ajustables.
 */
export function ImpactPage({ filter }: { filter: StatsFilter }) {
  return (
    <div className="stack">
      <LiveIndicators filter={filter} />
      <ModelMetrics />
      <Simulation />
    </div>
  );
}

const money = (x: number) => `RD$${n(Math.round(x))}`;
const kMoney = (x: number) => `RD$${n(Math.round(x / 1000))} mil`;
/** Cantidad con el sustantivo o verbo en singular o plural según corresponda. */
const cuenta = (x: number, uno: string, varios: string) => `${n(x)} ${x === 1 ? uno : varios}`;

// ---------------------------------------------------------------- 1. En vivo

function LiveIndicators({ filter }: { filter: StatsFilter }) {
  const valid = filterValid(filter);
  const sum = useApi<Envelope<Summary>>(valid ? `/stats/summary${qs(filterQuery(filter))}` : null, { topics: ['appointments', 'offers', 'catalog'] });
  const conv = useApi<Envelope<Conversation>>(valid ? `/stats/conversation${qs({ from: filter.from, to: filter.to })}` : null, { everyMs: 60_000 });
  const aht = DEFAULT_PARAMS.aht.mode;
  return (
    <Card title="Indicadores en vivo" subtitle="Datos reales del periodo elegido arriba"
      actions={<><Definition text={`Gestiones = reservas, cancelaciones, cambios y adelantos hechos por el chat. Las horas de personal evitadas suponen ${aht} minutos por llamada (valor más probable de la simulación).`} /><Updated q={sum} /></>}>
      <Async q={sum}>
        {({ data: d }) => {
          const gestiones = d.operations.bookings + d.operations.cancellations + d.operations.reschedules + d.operations.advances;
          return (
            <div className="kpis">
              <Kpi label="Gestiones hechas por el chat" value={n(gestiones)} detail={[cuenta(d.operations.bookings, 'reserva', 'reservas'), cuenta(d.operations.cancellations, 'cancelación', 'cancelaciones'), cuenta(d.operations.reschedules, 'cambio', 'cambios'), ...(d.operations.advances ? [cuenta(d.operations.advances, 'adelanto', 'adelantos')] : [])].join(' · ')} />
              <Kpi label="Horas de personal evitadas" value={`${n(Math.round((gestiones * aht) / 6) / 10)} h`} detail={`Si se hubieran atendido por teléfono (${aht} min cada una)`} />
              <Kpi label="Ocupación de la agenda" value={pct(d.occupancy.rate)} detail={`${n(d.occupancy.occupied)} de ${n(d.occupancy.enabled)} horarios`} />
              <Kpi label="Asistencia registrada" value={pct(d.attendance.rate)} detail={`${cuenta(d.attendance.completed, 'asistió', 'asistieron')} · ${cuenta(d.attendance.no_show, 'no asistió', 'no asistieron')}`} />
              {conv.data && <>
                <Kpi label="Tiempo de respuesta del modelo" value={conv.data.data.model_latency_ms.p50 === null ? '—' : `${n(conv.data.data.model_latency_ms.p50)} ms`}
                  detail={conv.data.data.model_latency_ms.n ? `Mediana · p90 ${n(conv.data.data.model_latency_ms.p90)} ms · n = ${n(conv.data.data.model_latency_ms.n)}` : 'Sin mediciones'} />
                <Kpi label="Fallos del modelo" value={pct(conv.data.data.replies ? conv.data.data.llm_errors / conv.data.data.replies : null)}
                  detail={`${n(conv.data.data.llm_errors)} de ${cuenta(conv.data.data.replies, 'respuesta', 'respuestas')}`} tone={conv.data.data.llm_errors ? 'warn' : undefined} />
              </>}
            </div>
          );
        }}
      </Async>
    </Card>
  );
}

// ---------------------------------------------------------------- 2. Precisión del modelo

function ModelMetrics() {
  const theme = useTheme();
  const [primary, local] = EVALUACION.models as [ModelEval, ModelEval];
  const groups = EVALUACION.variants;
  const config = useMemo(() => ({
    type: 'bar' as const,
    data: {
      labels: groups.map((g) => g.label),
      datasets: [
        { label: primary.label, data: groups.map((g) => Math.round(primary.byVariant[g.id]!.macroF1 * 100)), backgroundColor: cssVar('--c1') },
        { label: local.label, data: groups.map((g) => Math.round(local.byVariant[g.id]!.macroF1 * 100)), backgroundColor: cssVar('--c4') },
      ],
    },
    options: { scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'F1 macro (%)' } } } },
  }), [theme]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Card title="Precisión del modelo" subtitle={`Batería ${EVALUACION.battery}: ${EVALUACION.n} mensajes etiquetados (las mismas 20 solicitudes en 5 variantes de idioma), ejecutada en el servidor el ${EVALUACION.date}.`}
      actions={<Definition text="Precisión, recall y F1 de la intención detectada frente a la etiquetada. F1 macro: promedio del F1 de cada intención, sin que pesen más las intenciones frecuentes." />}>
      <div className="kpis">
        {[primary, local].map((m) => (
          <Kpi key={m.id} label={m.label} value={`${pct(m.macroF1, 0)} F1`}
            detail={`Exactitud ${pct(m.accuracy, 0)} · mediana ${n(m.latencyP50)} ms · p95 ${n(m.latencyP95)} ms`} />
        ))}
        <Kpi label="Acciones inseguras" value={n(primary.unsafe + local.unsafe)} detail="Preguntas clínicas o fuera de alcance clasificadas como reserva o cambio" />
      </div>
      <ChartView config={config as never} label="F1 macro por variante de idioma y modelo" height={240}
        table={{ caption: 'F1 macro por variante de idioma', columns: ['Variante', primary.label, local.label],
          rows: groups.map((g) => [g.label, pct(primary.byVariant[g.id]!.macroF1, 0), pct(local.byVariant[g.id]!.macroF1, 0)]) }} />
      <details className="chart-data">
        <summary>Precisión, recall y F1 por intención ({primary.label})</summary>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Métricas por intención">
          <table className="data compact">
            <thead><tr><th scope="col">Intención</th><th className="num" scope="col">Mensajes</th><th className="num" scope="col">Precisión</th><th className="num" scope="col">Recall</th><th className="num" scope="col">F1</th></tr></thead>
            <tbody>{primary.byIntent.map((r) => (
              <tr key={r.intent}><th scope="row">{r.label}</th><td className="num">{r.support}</td><td className="num">{pct(r.precision, 0)}</td><td className="num">{pct(r.recall, 0)}</td><td className="num">{pct(r.f1, 0)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}

// ---------------------------------------------------------------- 3. Monte Carlo

const SCENARIOS: { id: string; label: string; capacidad: number }[] = [
  { id: 'simulado', label: 'Hospital simulado (1,566 horarios/mes)', capacidad: 1566 },
  { id: 'mediano', label: 'Hospital mediano (5,000)', capacidad: 5000 },
  { id: 'grande', label: 'Hospital grande (12,000)', capacidad: 12000 },
];
/** Variables que se pueden ajustar con un control deslizante (las de mayor efecto o más discutibles). */
const ADJUSTABLE: ParamKey[] = ['adopcion', 'ocupacion', 'aht', 'salario', 'noshow', 'rr', 'alcance', 'margen', 'mantHoras', 'implHoras'];

/** Mueve el valor más probable y desplaza el rango en la misma proporción, dentro de los límites de la variable. */
function withMode(p: Params, k: ParamKey, mode: number): Params {
  const t = p[k]; const [lo, hi] = PARAM_INFO[k].limits;
  const f = t.mode ? mode / t.mode : 1;
  return { ...p, [k]: { min: Math.max(lo, Math.min(mode, t.min * f)), mode, max: Math.min(hi, Math.max(mode, t.max * f)) } };
}

const fmtParam = (k: ParamKey, v: number) => {
  const u = PARAM_INFO[k].unit;
  if (u === '%') return pct(v, 1);
  if (u === 'RD$') return money(v);
  if (u === '×') return v.toFixed(2);
  return `${n(Math.round(v * 10) / 10)} ${u}`;
};

function Simulation() {
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [runs, setRuns] = useState(10000);
  const [scenario, setScenario] = useState('simulado');
  const result = useMemo(() => simulate(params, runs), [params, runs]);
  const torn = useMemo(() => tornado(params), [params]);
  const setScenarioCap = (id: string) => {
    const c = SCENARIOS.find((s) => s.id === id)!.capacidad;
    setScenario(id);
    setParams((p) => ({ ...p, capacidad: { min: c, mode: c, max: c } }));
  };
  const s = result.stats;
  return (
    <Card title="Simulación Monte Carlo del impacto (12 meses)"
      subtitle={`${n(runs)} corridas con semilla ${result.seed}. Cada corrida toma un valor de cada variable incierta (distribución triangular) y calcula ahorro, costes y ROI.`}
      actions={<button type="button" className="ghost small" onClick={() => { setParams(DEFAULT_PARAMS); setScenario('simulado'); setRuns(10000); }}>Restablecer supuestos</button>}>
      <div className="sim-controls">
        <div className="segmented" role="group" aria-label="Tamaño del hospital">
          {SCENARIOS.map((x) => <button key={x.id} type="button" aria-pressed={scenario === x.id} onClick={() => setScenarioCap(x.id)}>{x.label}</button>)}
        </div>
        <label className="inline">Corridas
          <select value={runs} onChange={(e) => setRuns(Number(e.target.value))}>
            {[1000, 5000, 10000, 20000].map((r) => <option key={r} value={r}>{n(r)}</option>)}
          </select>
        </label>
      </div>

      <div className="kpis">
        <Kpi label="Probabilidad de ROI positivo" value={pct(result.probRoiAmpliado, 0)}
          detail={`Solo con ahorro de personal: ${pct(result.probRoiConservador, 0)}`}
          definition="ROI a 12 meses = (beneficios − costes) / costes, con la puesta en marcha incluida. «Solo con ahorro de personal» no cuenta las asistencias recuperadas." />
        <Kpi label="Beneficio neto mensual (P50)" value={kMoney(s.netoAmpliado.p50)} detail={`90 % de las corridas entre ${kMoney(s.netoAmpliado.p5)} y ${kMoney(s.netoAmpliado.p95)}`} />
        <Kpi label="Horas de personal liberadas al mes" value={`${n(Math.round(s.horasLiberadas.p50))} h`}
          detail={`${n(Math.round(s.horasLiberadas.p5))}–${n(Math.round(s.horasLiberadas.p95))} h · ${s.fte.p50.toFixed(2)} puestos de jornada completa`} />
        <Kpi label="Recuperación de la inversión" value={Number.isFinite(s.paybackAmpliado.p50) ? `${s.paybackAmpliado.p50.toFixed(1)} meses` : '—'}
          detail={`Probabilidad de recuperarla en 12 meses: ${pct(result.probPayback12, 0)}`} />
        <Kpi label="Asistencias recuperadas al mes" value={n(Math.round(s.asistenciasExtra.p50))} detail={`Por los recordatorios · ${kMoney(s.ingresoRecuperado.p50)} de valor recuperado`} />
        <Kpi label="Coste del modelo de IA al mes" value={money(s.costoIA.p50)} detail={`Servidor y mantenimiento incluidos: ${kMoney(s.costoMensual.p50)}`} />
      </div>

      <div className="grid-2">
        <Histogram result={result} />
        <Tornado rows={torn} />
      </div>

      <h3 className="group-title">Supuestos ajustables</h3>
      <p className="muted small">Cada control mueve el valor más probable; el mínimo y el máximo se desplazan en la misma proporción. Los resultados se recalculan al instante.</p>
      <div className="sim-sliders">
        {ADJUSTABLE.map((k) => {
          const info = PARAM_INFO[k]; const t = params[k];
          return (
            <label key={k} className="sim-slider">
              <span className="sim-slider-head"><span>{info.label}</span><strong>{fmtParam(k, t.mode)}</strong></span>
              <input type="range" min={info.limits[0]} max={info.limits[1]} step={info.step} value={t.mode}
                onChange={(e) => setParams((p) => withMode(p, k, Number(e.target.value)))} />
              <span className="muted small">Rango {fmtParam(k, t.min)} – {fmtParam(k, t.max)}</span>
            </label>
          );
        })}
      </div>

      <details className="chart-data">
        <summary>Todos los supuestos y sus fuentes</summary>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Supuestos de la simulación">
          <table className="data compact">
            <thead><tr><th scope="col">Variable</th><th className="num" scope="col">Mínimo</th><th className="num" scope="col">Más probable</th><th className="num" scope="col">Máximo</th><th scope="col">Origen</th></tr></thead>
            <tbody>{(Object.keys(PARAM_INFO) as ParamKey[]).map((k) => (
              <tr key={k}><th scope="row">{PARAM_INFO[k].label}</th>
                <td className="num">{fmtParam(k, params[k].min)}</td><td className="num">{fmtParam(k, params[k].mode)}</td><td className="num">{fmtParam(k, params[k].max)}</td>
                <td><Badge tone={PARAM_INFO[k].kind === 'supuesto' ? 'warn' : 'info'}>{PARAM_INFO[k].kind}</Badge> {PARAM_INFO[k].source}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <p className="muted small">Jornada de {HORAS_MES.toFixed(1)} h al mes (44 h semanales). Precio del modelo: US$0,15 por millón de tokens de entrada y US$0,60 de salida (Groq); tasa de RD$60,52 por dólar (Banco Central, 28-oct-2026).</p>
      </details>

      <details className="chart-data">
        <summary>Resultados de la simulación (P5, P50 y P95)</summary>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Resultados por percentil">
          <table className="data compact">
            <thead><tr><th scope="col">Resultado mensual</th><th className="num" scope="col">P5</th><th className="num" scope="col">P50</th><th className="num" scope="col">P95</th></tr></thead>
            <tbody>{RESULT_ROWS.map(([k, label, f]) => (
              <tr key={k}><th scope="row">{label}</th><td className="num">{f(s[k].p5)}</td><td className="num">{f(s[k].p50)}</td><td className="num">{f(s[k].p95)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}

const RESULT_ROWS: [keyof SimResult['stats'], string, (x: number) => string][] = [
  ['citas', 'Citas atendidas en la agenda', (x) => n(Math.round(x))],
  ['llamadasEvitadas', 'Llamadas evitadas', (x) => n(Math.round(x))],
  ['horasLiberadas', 'Horas de personal liberadas', (x) => `${n(Math.round(x))} h`],
  ['ahorroPersonal', 'Ahorro en tiempo de personal', money],
  ['asistenciasExtra', 'Asistencias recuperadas', (x) => n(Math.round(x))],
  ['ingresoRecuperado', 'Valor de las asistencias recuperadas', money],
  ['costoMensual', 'Coste mensual (servidor, IA y mantenimiento)', money],
  ['netoConservador', 'Beneficio neto, solo ahorro de personal', money],
  ['netoAmpliado', 'Beneficio neto con asistencias recuperadas', money],
  ['roiAmpliado', 'ROI a 12 meses', (x) => pct(x, 0)],
];

function Histogram({ result }: { result: SimResult }) {
  const theme = useTheme();
  const bins = useMemo(() => histogram(result.outcomes.map((o) => o.netoAmpliado), 24), [result]);
  const config = useMemo(() => ({
    type: 'bar' as const,
    data: {
      labels: bins.map((b) => `${n(Math.round((b.from + b.to) / 2000))}`),
      datasets: [{ label: 'Corridas', data: bins.map((b) => b.count), backgroundColor: bins.map((b) => ((b.from + b.to) / 2 < 0 ? cssVar('--c3') : cssVar('--c1'))) }],
    },
    options: { plugins: { legend: { display: false } }, scales: {
      x: { title: { display: true, text: 'Beneficio neto mensual (miles de RD$)' }, ticks: { maxRotation: 0, autoSkipPadding: 10 } },
      y: { beginAtZero: true, title: { display: true, text: 'Corridas' } } } },
  }), [bins, theme]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <figure className="sim-figure">
      <figcaption><strong>Distribución del beneficio neto mensual</strong><span className="muted small">En rosa, las corridas con pérdida.</span></figcaption>
      <ChartView config={config as never} label="Histograma del beneficio neto mensual en las corridas" height={240}
        table={{ caption: 'Histograma del beneficio neto mensual', columns: ['Desde (RD$)', 'Hasta (RD$)', 'Corridas'], rows: bins.map((b) => [money(b.from), money(b.to), b.count]) }} />
    </figure>
  );
}

/** Parte una etiqueta larga en líneas para que el eje no la corte. */
function wrapLabel(text: string, max = 26): string[] {
  const lines: string[] = [];
  for (const word of text.split(' ')) {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + word).length <= max) lines[lines.length - 1] = last + ' ' + word;
    else lines.push(word);
  }
  return lines;
}

function Tornado({ rows }: { rows: ReturnType<typeof tornado> }) {
  const theme = useTheme();
  const top = rows.slice(0, 8);
  const config = useMemo(() => ({
    type: 'bar' as const,
    data: {
      labels: top.map((r) => wrapLabel(r.label)),
      datasets: [{ label: 'Beneficio neto mensual', data: top.map((r) => [Math.min(r.low, r.high) / 1000, Math.max(r.low, r.high) / 1000]), backgroundColor: cssVar('--c2') }],
    },
    options: { indexAxis: 'y' as const, plugins: { legend: { display: false } },
      scales: { x: { title: { display: true, text: 'Beneficio neto mensual (miles de RD$)' } }, y: { ticks: { autoSkip: false } } } },
  }), [rows, theme]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <figure className="sim-figure">
      <figcaption><strong>Sensibilidad: qué variables mueven más el resultado</strong><span className="muted small">Cada barra va del mínimo al máximo de la variable, con las demás en su valor más probable.</span></figcaption>
      <ChartView config={config as never} label="Gráfico de tornado de sensibilidad del beneficio neto mensual" height={340}
        table={{ caption: 'Sensibilidad del beneficio neto mensual', columns: ['Variable', 'Con el mínimo', 'Con el máximo'], rows: top.map((r) => [r.label, money(r.low), money(r.high)]) }} />
    </figure>
  );
}
