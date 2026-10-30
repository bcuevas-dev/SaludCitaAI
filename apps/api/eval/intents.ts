// Evaluación del intérprete por intención y por subgrupo de idioma (batería tests/conversation/multilingue-v1.json).
// Usa el mismo prompt (buildOllamaRequest), el mismo validador (parseInterpretation) y la misma pasarela que la API.
// Mide cada modelo por separado: el proveedor sin respaldo («primary») o el modelo local («local»).
//
// Uso en el servidor, dentro del contenedor de la API (la clave del proveedor no sale del contenedor). El archivo va en
// /app/apps/api/eval para que encuentre node_modules; pasos completos en docs/impacto-simulacion.md:
//   docker exec -w /app/apps/api/eval -e EVAL_SRC=/app/apps/api/dist saludcita-api-1 node intents.ts primary|local
// Variables: EVAL_BATTERY (ruta del JSON), EVAL_PAUSE_MS (pausa entre mensajes por el límite por minuto del proveedor).
// Imprime el JSON de resultados por la salida estándar; el progreso va por la salida de error.

import { readFileSync } from 'node:fs';
import pg from 'pg';

const SRC = process.env.EVAL_SRC ?? '../src';
const { buildOllamaRequest, parseInterpretation, PROMPT_VERSION } = await import(`${SRC}/modules/conversation/llm.js`);
const { gatewayChat } = await import(`${SRC}/modules/conversation/llm-gateway.js`);
const { matchSpecialty } = await import(`${SRC}/modules/conversation/engine.js`);
const { loadConfig } = await import(`${SRC}/config/env.js`);

const which = process.argv[2] === 'local' ? 'local' : 'primary';
const battery = JSON.parse(readFileSync(process.env.EVAL_BATTERY ?? '../../tests/conversation/multilingue-v1.json', 'utf8'));
const PAUSE = Number(process.env.EVAL_PAUSE_MS ?? (which === 'primary' ? 8000 : 0));
const cfg = loadConfig();

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const specialties = (await db.query('SELECT id, name FROM specialties WHERE active ORDER BY name')).rows;
await db.end();

/** Una llamada al modelo elegido. «primary» va sin respaldo para no mezclar modelos en la medición. */
async function ask(body: any) {
  if (which === 'primary') {
    return gatewayChat({ apiBase: cfg.llmApiBase, apiKey: cfg.llmApiKey!, model: cfg.llmApiModel, timeoutMs: cfg.llmTimeoutMs }, body);
  }
  const t0 = performance.now();
  const res = await fetch(`${cfg.ollamaUrl}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, model: cfg.ollamaModel, think: false }), signal: AbortSignal.timeout(300_000) });
  const json: any = await res.json().catch(() => null);
  return res.ok && json?.message ? { ok: true, body: { ...json, total_duration: Math.round((performance.now() - t0) * 1e6) } }
    : { ok: false, status: res.status, error: String(json?.error ?? res.status) };
}

const results: any[] = [];
for (const c of battery.cases) {
  const req = buildOllamaRequest(cfg.ollamaModel, c.text, { step: c.context.step, optionsOffered: c.context.options_offered,
    specialties: specialties.map((s) => s.name), history: [] });
  let r: any;
  // Límite por minuto del proveedor (429): espera y reintenta hasta 3 veces
  for (let attempt = 0; attempt < 4; attempt++) {
    const t0 = performance.now();
    r = await ask(req);
    r.wall_ms = Math.round(performance.now() - t0);
    if (r.ok || r.status !== 429) break;
    await new Promise((ok) => setTimeout(ok, 65_000));
  }
  const parsed = r.ok ? parseInterpretation(r.body.message.content) : { ok: false, error: r.error };
  const v = parsed.ok ? parsed.value : null;
  results.push({
    id: c.id, base: c.base, variant: c.variant, text: c.text, expected: c.expected,
    got_intent: v?.intent ?? null, got_specialty: v ? matchSpecialty(v.specialty, specialties)?.name ?? null : null,
    got_option: v?.option_number ?? null, schema_valid: parsed.ok, error: parsed.ok ? null : parsed.error,
    latency_ms: r.ok ? Math.round(r.body.total_duration / 1e6) : null, wall_ms: r.wall_ms,
    prompt_tokens: r.ok ? r.body.prompt_eval_count ?? null : null, completion_tokens: r.ok ? r.body.eval_count ?? null : null,
  });
  process.stderr.write(`${which} ${c.id} ${v?.intent ?? 'ERROR'} ${r.wall_ms} ms\n`);
  if (PAUSE) await new Promise((ok) => setTimeout(ok, PAUSE));
}

process.stdout.write(JSON.stringify({
  battery: battery.version, prompt_version: PROMPT_VERSION, executed_at: new Date().toISOString(),
  model: which === 'primary' ? cfg.llmApiModel : cfg.ollamaModel, provider: which === 'primary' ? 'Groq' : 'Ollama (servidor, sin GPU)',
  results,
}, null, 1));
