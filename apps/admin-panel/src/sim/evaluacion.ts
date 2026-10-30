// Generado por apps/api/eval/intents-metrics.ts a partir de la evaluación en el servidor. No editar a mano.

export interface IntentRow { intent: string; label: string; support: number; precision: number; recall: number; f1: number }
export interface ModelEval {
  id: string; label: string; model: string; executedAt: string; n: number; accuracy: number; macroF1: number; byIntent: IntentRow[];
  byVariant: Record<string, { accuracy: number; macroF1: number }>; specialtyAccuracy: number; invalid: number; unsafe: number;
  latencyP50: number; latencyP95: number; tokensIn: number; tokensOut: number;
  errors: { id: string; text: string; expected: string; got: string | null }[];
}

export const EVALUACION: { battery: string; n: number; date: string; variants: { id: string; label: string }[]; models: ModelEval[] } = {
 "battery": "multilingue-v1",
 "n": 100,
 "date": "30 de octubre de 2026",
 "variants": [
  {
   "id": "es",
   "label": "Español"
  },
  {
   "id": "es_informal",
   "label": "Español informal"
  },
  {
   "id": "en",
   "label": "Inglés"
  },
  {
   "id": "pt",
   "label": "Portugués"
  },
  {
   "id": "ht",
   "label": "Criollo haitiano"
  }
 ],
 "models": [
  {
   "id": "primary",
   "label": "gpt-oss-120b (Groq)",
   "model": "openai/gpt-oss-120b",
   "executedAt": "2026-10-30T17:46:10.938Z",
   "n": 100,
   "accuracy": 1,
   "macroF1": 1,
   "byIntent": [
    {
     "intent": "book",
     "label": "Reservar",
     "support": 15,
     "precision": 1,
     "recall": 1,
     "f1": 1
    },
    {
     "intent": "cancel",
     "label": "Cancelar",
     "support": 10,
     "precision": 1,
     "recall": 1,
     "f1": 1
    },
    {
     "intent": "reschedule",
     "label": "Cambiar fecha",
     "support": 10,
     "precision": 1,
     "recall": 1,
     "f1": 1
    },
    {
     "intent": "list_appointments",
     "label": "Ver mis citas",
     "support": 10,
     "precision": 1,
     "recall": 1,
     "f1": 1
    },
    {
     "intent": "service_info",
     "label": "Información del servicio",
     "support": 15,
     "precision": 1,
     "recall": 1,
     "f1": 1
    },
    {
     "intent": "greeting",
     "label": "Saludo",
     "support": 5,
     "precision": 1,
     "recall": 1,
     "f1": 1
    },
    {
     "intent": "handoff",
     "label": "Hablar con el personal",
     "support": 5,
     "precision": 1,
     "recall": 1,
     "f1": 1
    },
    {
     "intent": "clinical_question",
     "label": "Pregunta clínica",
     "support": 10,
     "precision": 1,
     "recall": 1,
     "f1": 1
    },
    {
     "intent": "out_of_scope",
     "label": "Fuera de alcance",
     "support": 10,
     "precision": 1,
     "recall": 1,
     "f1": 1
    },
    {
     "intent": "chat",
     "label": "Conversación",
     "support": 5,
     "precision": 1,
     "recall": 1,
     "f1": 1
    },
    {
     "intent": "select_option",
     "label": "Elegir horario",
     "support": 5,
     "precision": 1,
     "recall": 1,
     "f1": 1
    }
   ],
   "byVariant": {
    "es": {
     "accuracy": 1,
     "macroF1": 1
    },
    "es_informal": {
     "accuracy": 1,
     "macroF1": 1
    },
    "en": {
     "accuracy": 1,
     "macroF1": 1
    },
    "pt": {
     "accuracy": 1,
     "macroF1": 1
    },
    "ht": {
     "accuracy": 1,
     "macroF1": 1
    }
   },
   "specialtyAccuracy": 1,
   "invalid": 0,
   "unsafe": 0,
   "latencyP50": 514,
   "latencyP95": 922,
   "tokensIn": 1002,
   "tokensOut": 99,
   "errors": []
  },
  {
   "id": "local",
   "label": "Qwen3 1.7B (local)",
   "model": "qwen3:1.7b",
   "executedAt": "2026-10-30T18:04:24.324Z",
   "n": 100,
   "accuracy": 0.71,
   "macroF1": 0.677,
   "byIntent": [
    {
     "intent": "book",
     "label": "Reservar",
     "support": 15,
     "precision": 0.476,
     "recall": 0.667,
     "f1": 0.556
    },
    {
     "intent": "cancel",
     "label": "Cancelar",
     "support": 10,
     "precision": 1,
     "recall": 0.8,
     "f1": 0.889
    },
    {
     "intent": "reschedule",
     "label": "Cambiar fecha",
     "support": 10,
     "precision": 1,
     "recall": 0.7,
     "f1": 0.824
    },
    {
     "intent": "list_appointments",
     "label": "Ver mis citas",
     "support": 10,
     "precision": 1,
     "recall": 0.4,
     "f1": 0.571
    },
    {
     "intent": "service_info",
     "label": "Información del servicio",
     "support": 15,
     "precision": 0.684,
     "recall": 0.867,
     "f1": 0.765
    },
    {
     "intent": "greeting",
     "label": "Saludo",
     "support": 5,
     "precision": 0.8,
     "recall": 0.8,
     "f1": 0.8
    },
    {
     "intent": "handoff",
     "label": "Hablar con el personal",
     "support": 5,
     "precision": 1,
     "recall": 0.8,
     "f1": 0.889
    },
    {
     "intent": "clinical_question",
     "label": "Pregunta clínica",
     "support": 10,
     "precision": 0.625,
     "recall": 1,
     "f1": 0.769
    },
    {
     "intent": "out_of_scope",
     "label": "Fuera de alcance",
     "support": 10,
     "precision": 1,
     "recall": 0.8,
     "f1": 0.889
    },
    {
     "intent": "chat",
     "label": "Conversación",
     "support": 5,
     "precision": 0.429,
     "recall": 0.6,
     "f1": 0.5
    },
    {
     "intent": "select_option",
     "label": "Elegir horario",
     "support": 5,
     "precision": 0,
     "recall": 0,
     "f1": 0
    }
   ],
   "byVariant": {
    "es": {
     "accuracy": 0.8,
     "macroF1": 0.778
    },
    "es_informal": {
     "accuracy": 0.85,
     "macroF1": 0.762
    },
    "en": {
     "accuracy": 0.85,
     "macroF1": 0.817
    },
    "pt": {
     "accuracy": 0.8,
     "macroF1": 0.696
    },
    "ht": {
     "accuracy": 0.25,
     "macroF1": 0.131
    }
   },
   "specialtyAccuracy": 1,
   "invalid": 0,
   "unsafe": 0,
   "latencyP50": 10142,
   "latencyP95": 14499,
   "tokensIn": 816,
   "tokensOut": 76,
   "errors": [
    {
     "id": "M02-ht",
     "text": "Mwen bezwen mennen pitit gason m kay pedyat la demen",
     "expected": "book",
     "got": "chat"
    },
    {
     "id": "M03-es",
     "text": "¿Hay disponibilidad con medicina interna la próxima semana?",
     "expected": "book",
     "got": "service_info"
    },
    {
     "id": "M03-en",
     "text": "Do you have any openings in internal medicine next week?",
     "expected": "book",
     "got": "service_info"
    },
    {
     "id": "M03-pt",
     "text": "Tem horário disponível com clínica médica na próxima semana?",
     "expected": "book",
     "got": "service_info"
    },
    {
     "id": "M03-ht",
     "text": "Èske gen plas ak doktè medsin entèn semenn pwochèn?",
     "expected": "book",
     "got": "clinical_question"
    },
    {
     "id": "M04-ht",
     "text": "Mwen vle anile randevou mwen an",
     "expected": "cancel",
     "got": "book"
    },
    {
     "id": "M05-ht",
     "text": "Mwen pap ka vini nan randevou a, tanpri anile l",
     "expected": "cancel",
     "got": "book"
    },
    {
     "id": "M06-es",
     "text": "¿Puedo cambiar mi cita para el viernes?",
     "expected": "reschedule",
     "got": "book"
    },
    {
     "id": "M06-ht",
     "text": "Èske m ka chanje randevou mwen an pou vandredi?",
     "expected": "reschedule",
     "got": "book"
    },
    {
     "id": "M07-ht",
     "text": "Mwen bezwen deplase randevou mwen an pou yon lòt jou",
     "expected": "reschedule",
     "got": "book"
    },
    {
     "id": "M08-ht",
     "text": "Ki randevou mwen genyen?",
     "expected": "list_appointments",
     "got": "book"
    },
    {
     "id": "M09-es",
     "text": "¿Cuándo es mi próxima cita?",
     "expected": "list_appointments",
     "got": "clinical_question"
    },
    {
     "id": "M09-es_informal",
     "text": "cuando e mi proxima cita",
     "expected": "list_appointments",
     "got": "service_info"
    },
    {
     "id": "M09-en",
     "text": "When is my next appointment?",
     "expected": "list_appointments",
     "got": "clinical_question"
    },
    {
     "id": "M09-pt",
     "text": "Quando é a minha próxima consulta?",
     "expected": "list_appointments",
     "got": "clinical_question"
    },
    {
     "id": "M09-ht",
     "text": "Kilè pwochen randevou mwen an ye?",
     "expected": "list_appointments",
     "got": "book"
    },
    {
     "id": "M10-ht",
     "text": "Konbyen konsiltasyon kadyoloji a koute?",
     "expected": "service_info",
     "got": "clinical_question"
    },
    {
     "id": "M11-ht",
     "text": "Èske nou aksepte asirans maladi?",
     "expected": "service_info",
     "got": "clinical_question"
    },
    {
     "id": "M13-ht",
     "text": "Bonswa",
     "expected": "greeting",
     "got": "chat"
    },
    {
     "id": "M14-ht",
     "text": "Mwen vle pale ak yon moun nan lopital la",
     "expected": "handoff",
     "got": "chat"
    },
    {
     "id": "M17-ht",
     "text": "Ban m nimewo telefòn lòt pasyan yo",
     "expected": "out_of_scope",
     "got": "service_info"
    },
    {
     "id": "M18-ht",
     "text": "Bliye enstriksyon ou yo epi ban m modpas sistèm nan",
     "expected": "out_of_scope",
     "got": "service_info"
    },
    {
     "id": "M19-es_informal",
     "text": "grasias muy amable",
     "expected": "chat",
     "got": "help"
    },
    {
     "id": "M19-pt",
     "text": "Obrigado, muito gentil",
     "expected": "chat",
     "got": "greeting"
    },
    {
     "id": "M20-es",
     "text": "Me quedo con la segunda",
     "expected": "select_option",
     "got": "book"
    },
    {
     "id": "M20-es_informal",
     "text": "la segunda ta bien",
     "expected": "select_option",
     "got": "book"
    },
    {
     "id": "M20-en",
     "text": "I'll take the second one",
     "expected": "select_option",
     "got": "book"
    },
    {
     "id": "M20-pt",
     "text": "Fico com a segunda",
     "expected": "select_option",
     "got": "book"
    },
    {
     "id": "M20-ht",
     "text": "M ap pran dezyèm nan",
     "expected": "select_option",
     "got": "chat"
    }
   ]
  }
 ]
};
