# Impacto, simulación Monte Carlo y evaluación multilingüe

Este documento resume las piezas añadidas para medir el impacto del sistema: la evaluación del intérprete por intención e idioma, la simulación del retorno para el hospital y la sección del panel que muestra ambas. Panel: **Estadísticas › Impacto y simulación** (`#/estadisticas/impacto`, rol `viewer`).

## 1. Evaluación por intención y por idioma (`multilingue-v1`)

- **Batería:** [tests/conversation/multilingue-v1.json](../tests/conversation/multilingue-v1.json). 20 solicitudes base escritas de 5 formas (español, español informal sin tildes, inglés, portugués y criollo haitiano): 100 mensajes. Cada caso trae la intención esperada y, cuando aplica, la especialidad o la opción elegida.
- **Evaluador:** [apps/api/eval/intents.ts](../apps/api/eval/intents.ts). Usa el mismo prompt, el mismo validador y la misma pasarela que la API. `primary` mide el proveedor **sin respaldo** (para no mezclar modelos); `local` mide Ollama.
- **Métricas:** [apps/api/eval/intents-metrics.ts](../apps/api/eval/intents-metrics.ts). Precisión, exhaustividad y F1 por intención, F1 macro global y por idioma, e intervalo de Clopper-Pearson del 95 % para la exactitud. Escribe [apps/admin-panel/src/sim/evaluacion.ts](../apps/admin-panel/src/sim/evaluacion.ts), que lee el panel.

Resultados (30-oct-2026, servidor de producción, una ejecución por modelo):

| Modelo | Exactitud | F1 macro | es | es informal | en | pt | ht | Latencia p50 / p95 | Acciones inseguras |
|---|---|---|---|---|---|---|---|---|---|
| gpt-oss-120b (Groq) | 1.00 (IC 95 %: 0.964–1) | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 514 / 922 ms | 0 |
| Qwen3 1.7B (local) | 0.71 | 0.677 | 0.778 | 0.762 | 0.817 | 0.696 | **0.131** | 10,142 / 14,499 ms | 0 |

- «Acción insegura» = una pregunta clínica, fuera de ámbito o de saludo interpretada como reserva, cancelación o cambio.
- La batería tiene solicitudes claras; con 20 mensajes por idioma, el intervalo de cada idioma con Groq va de 0.83 a 1.
- **Sesgo detectado:** el modelo de respaldo casi no entiende el criollo haitiano y confunde la elección de una opción con una reserva nueva. Cuando responde el respaldo, el paciente haitiano recibe un servicio peor. Mitigación propuesta: ofrecer el menú guiado cuando responde el respaldo y medir cada mes un F1 ≥ 0.95 en cada idioma.

Reproducción en el servidor. El evaluador se copia junto a `node_modules` de la API, y la clave del proveedor no sale del contenedor:

```bash
docker exec -u root saludcita-api-1 mkdir -p /app/apps/api/eval
docker cp apps/api/eval/intents.ts saludcita-api-1:/app/apps/api/eval/
docker cp tests/conversation/multilingue-v1.json saludcita-api-1:/app/apps/api/eval/
docker exec -w /app/apps/api/eval -e EVAL_SRC=/app/apps/api/dist -e EVAL_BATTERY=multilingue-v1.json saludcita-api-1 node intents.ts primary > resultados-groq.json
docker exec -w /app/apps/api/eval -e EVAL_SRC=/app/apps/api/dist -e EVAL_BATTERY=multilingue-v1.json saludcita-api-1 node intents.ts local > resultados-qwen.json
node apps/api/eval/intents-metrics.ts resultados-groq.json resultados-qwen.json metricas.json
```

Con Groq hay una pausa de 8 s entre mensajes por su límite por minuto (`EVAL_PAUSE_MS`); la ejecución completa tarda unos 15 min.

## 2. Simulación Monte Carlo del retorno

- **Modelo:** [apps/admin-panel/src/sim/montecarlo.ts](../apps/admin-panel/src/sim/montecarlo.ts), módulo puro sin dependencias. El panel y el script usan el mismo código.
- **Método:** 10,000 corridas con distribuciones triangulares (mínimo, más probable, máximo), semilla fija 2026 (mulberry32), horizonte de 12 meses. Cada variable declara su origen: **medido** en el sistema (horarios, precios, mensajes y tokens), **fuente** publicada (tiempo por llamada, salario, inasistencia, efecto de los recordatorios, precio del servidor y del modelo) o **supuesto** del equipo, que el piloto debe medir (adopción, alcance de los recordatorios).
- **Dos ROI:**
  - *Conservador*: solo el ahorro de tiempo de personal.
  - *Ampliado*: suma la parte de la tarifa que el hospital deja de perder por las asistencias recuperadas con los recordatorios.
- **Script:** [apps/admin-panel/scripts/simulacion.ts](../apps/admin-panel/scripts/simulacion.ts) corre los tres escenarios, la sensibilidad (tornado) y los puntos de equilibrio, y escribe un JSON:

```bash
cd apps/admin-panel && node scripts/simulacion.ts simulacion.json
```

Resultados (mediana de 10,000 corridas):

| Escenario (horarios al mes) | Horas de personal liberadas | Beneficio neto ampliado / mes | Coste de IA / mes | P(ROI > 0) conservador | P(ROI > 0) ampliado |
|---|---|---|---|---|---|
| Hospital simulado (1,566) | 71 (P5–P95: 42–111) | RD$21,727 | RD$82 | 22.8 % | 98.3 % |
| Mediano (5,000) | 226 | RD$84,371 | RD$262 | 98.6 % | 100 % |
| Grande (12,000) | 543 | RD$211,887 | RD$629 | 100 % | 100 % |

- Inversión inicial (valor más probable): unos RD$59,500. Operación: unos RD$6,700 al mes (servidor y mantenimiento).
- Punto de equilibrio del ROI conservador: 45.6 % de gestiones por el chat, o 1786 horarios al mes.
- La variable que más mueve el resultado es la adopción del chat.

## 3. Sección del panel

[apps/admin-panel/src/pages/Impact.tsx](../apps/admin-panel/src/pages/Impact.tsx) tiene tres bloques:

1. **Indicadores en vivo** del periodo elegido: gestiones hechas por el chat, horas de personal evitadas, ocupación, asistencia registrada, tiempo de respuesta y fallos del modelo (`/stats/summary`, `/stats/conversation`).
2. **Métricas del modelo:** F1 por idioma y tabla por intención de los dos modelos.
3. **Simulación:** escenario, número de corridas, KPIs con percentiles, histograma del beneficio neto, tornado de sensibilidad y controles para ajustar los supuestos. Todo se calcula en el navegador; no envía datos al servidor.

## 4. Privacidad: lo que recibe el proveedor del modelo

Revisado en el código el 30-oct-2026: al proveedor le llegan el texto de la conversación y el **nombre de pila** del paciente; si pregunta por sus citas, también la fecha, el médico y la especialidad. No recibe apellidos, teléfono, correo, documentos ni datos de otros pacientes. Pendiente antes de un piloto: quitar la especialidad del prompt, acuerdo sin retención de datos con el proveedor y consentimiento expreso del paciente (Ley 172-13).
