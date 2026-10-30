// Métricas de la batería multilingüe a partir de los resultados de eval/intents.ts: exactitud, precisión, recall y F1
// por intención y F1 macro por variante de idioma. Escribe el módulo que muestra el panel (Impacto y simulación).
//
// Uso (desde apps/api): node eval/intents-metrics.ts resultados-groq.json resultados-qwen.json [metricas.json]
// Las respuestas que no cumplen el esquema cuentan como error («sin respuesta válida»).

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../..');
const OUT = resolve(ROOT, 'apps/admin-panel/src/sim/evaluacion.ts');

const VARIANTS = [
  { id: 'es', label: 'Español' }, { id: 'es_informal', label: 'Español informal' }, { id: 'en', label: 'Inglés' },
  { id: 'pt', label: 'Portugués' }, { id: 'ht', label: 'Criollo haitiano' },
];
const INTENT_LABELS: Record<string, string> = {
  book: 'Reservar', cancel: 'Cancelar', reschedule: 'Cambiar fecha', list_appointments: 'Ver mis citas', service_info: 'Información del servicio',
  greeting: 'Saludo', handoff: 'Hablar con el personal', clinical_question: 'Pregunta clínica', out_of_scope: 'Fuera de alcance',
  chat: 'Conversación', select_option: 'Elegir horario',
};
const ACTIONABLE = new Set(['book', 'cancel', 'reschedule', 'select_option', 'affirm']);

const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0; };
const round = (x: number) => Math.round(x * 1000) / 1000;

function metrics(rows: any[]) {
  const labels = [...new Set(rows.map((r) => r.expected.intent as string))];
  const byIntent = labels.map((l) => {
    const tp = rows.filter((r) => r.expected.intent === l && r.got_intent === l).length;
    const fp = rows.filter((r) => r.expected.intent !== l && r.got_intent === l).length;
    const fn = rows.filter((r) => r.expected.intent === l && r.got_intent !== l).length;
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    return { intent: l, label: INTENT_LABELS[l] ?? l, support: tp + fn, precision: round(precision), recall: round(recall),
      f1: round(precision + recall ? (2 * precision * recall) / (precision + recall) : 0) };
  });
  return {
    accuracy: round(rows.filter((r) => r.got_intent === r.expected.intent).length / rows.length),
    macroF1: round(byIntent.reduce((a, b) => a + b.f1, 0) / byIntent.length),
    byIntent,
  };
}

function evalModel(file: string, id: string, label: string) {
  const d = JSON.parse(readFileSync(file, 'utf8'));
  const rows = d.results as any[];
  const all = metrics(rows);
  const lat = rows.map((r) => r.latency_ms).filter((x) => x !== null);
  const book = rows.filter((r) => r.expected.specialty);
  return {
    id, label, model: d.model, executedAt: d.executed_at, n: rows.length, ...all,
    byVariant: Object.fromEntries(VARIANTS.map((v) => {
      const m = metrics(rows.filter((r) => r.variant === v.id));
      return [v.id, { accuracy: m.accuracy, macroF1: m.macroF1 }];
    })),
    specialtyAccuracy: round(book.filter((r) => r.got_specialty === r.expected.specialty).length / book.length),
    invalid: rows.filter((r) => !r.schema_valid).length,
    unsafe: rows.filter((r) => ['clinical_question', 'out_of_scope'].includes(r.expected.intent) && ACTIONABLE.has(r.got_intent)).length,
    latencyP50: pct(lat, 0.5), latencyP95: pct(lat, 0.95),
    tokensIn: Math.round(rows.reduce((a, r) => a + (r.prompt_tokens ?? 0), 0) / rows.length),
    tokensOut: Math.round(rows.reduce((a, r) => a + (r.completion_tokens ?? 0), 0) / rows.length),
    errors: rows.filter((r) => r.got_intent !== r.expected.intent).map((r) => ({ id: r.id, text: r.text, expected: r.expected.intent, got: r.got_intent })),
  };
}

const [groqFile, qwenFile, jsonOut] = process.argv.slice(2);
if (!groqFile || !qwenFile) throw new Error('Uso: node eval/intents-metrics.ts resultados-groq.json resultados-qwen.json');
const models = [evalModel(groqFile, 'primary', 'gpt-oss-120b (Groq)'), evalModel(qwenFile, 'local', 'Qwen3 1.7B (local)')];
const date = new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Santo_Domingo' }).format(new Date(models[0]!.executedAt));
const data = { battery: 'multilingue-v1', n: models[0]!.n, date, variants: VARIANTS, models };

writeFileSync(OUT, `// Generado por apps/api/eval/intents-metrics.ts a partir de la evaluación en el servidor. No editar a mano.

export interface IntentRow { intent: string; label: string; support: number; precision: number; recall: number; f1: number }
export interface ModelEval {
  id: string; label: string; model: string; executedAt: string; n: number; accuracy: number; macroF1: number; byIntent: IntentRow[];
  byVariant: Record<string, { accuracy: number; macroF1: number }>; specialtyAccuracy: number; invalid: number; unsafe: number;
  latencyP50: number; latencyP95: number; tokensIn: number; tokensOut: number;
  errors: { id: string; text: string; expected: string; got: string | null }[];
}

export const EVALUACION: { battery: string; n: number; date: string; variants: { id: string; label: string }[]; models: ModelEval[] } = ${JSON.stringify(data, null, 1)};
`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(data, null, 1));
process.stdout.write(JSON.stringify(models.map(({ errors, byIntent, ...m }) => ({ ...m, errors: errors.length })), null, 1) + '\n');
