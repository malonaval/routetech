const MODEL = 'llama-3.3-70b-versatile'

export async function callGroqAPI(apiKey, origin, orders) {
  const ordersText = orders
    .map(
      (o, i) =>
        `${i + 1}. ID:${o.id} | Cliente:${o.cliente} | Dir:${o.direccion} | ` +
        `Dur:${o.duracion}min | Ventana:${o.ventana_tipo}` +
        (o.ventana_inicio ? ` (${o.ventana_inicio}–${o.ventana_fin})` : '')
    )
    .join('\n')

  const prompt = `Ordena estas órdenes de trabajo minimizando tiempo total de desplazamiento, respetando ventanas fijas.

INICIO: ${origin} · HORA INICIO: 09:00

ÓRDENES:
${ordersText}

REGLAS:
- Ventanas "fija": cumplir en la franja exacta
- Ventanas "flexible": reordenar libremente para minimizar km totales
- CRÍTICO: Si hay paradas FLEXIBLE cercanas al punto de inicio, visítalas PRIMERO antes de ir a la primera parada fija, siempre que no impida llegar a tiempo a la ventana fija. Aprovecha el tiempo muerto antes de la primera ventana fija para visitar paradas próximas al origen.
- Tiempos de desplazamiento en Madrid: 8-25 min en coche, 5-10 min a pie si <700m
- Calcula hora de llegada acumulada para cada parada desde las 09:00 en el INICIO
- saving_minutes = ahorro vs orden original
- El recorrido debe ser geográficamente eficiente: nunca volver sobre tus pasos innecesariamente

Devuelve ÚNICAMENTE este JSON (sin texto adicional):
{
  "saving_minutes": 40,
  "total_km": 24,
  "end_time": "19:00",
  "reasoning": "Explicación concreta: menciona qué clientes tienen ventana fija y por qué se visitan en ese orden, qué clientes flexibles se agruparon por proximidad geográfica, y qué ahorro se consigue respecto al orden original. Usa nombres de clientes reales y calles.",
  "sequence": [
    {
      "position": 1,
      "ot_id": "OT-XXXX",
      "cliente": "nombre",
      "arrival_time": "10:00",
      "travel_minutes": 12,
      "transport": "coche",
      "window_type": "fija",
      "window": "10:00-11:00",
      "window_status": "en hora"
    }
  ],
  "savings_breakdown": {
    "original_estimated_mins": 180,
    "optimised_mins": 120,
    "original_estimated_km": 67,
    "optimised_km": 46
  },
  "call_suggestions": [
    {
      "ot_id": "OT-XXXX",
      "cliente": "nombre",
      "current_window": "09:00–10:00",
      "suggested_time": "11:30",
      "potential_saving_minutes": 18,
      "reason": "Citándolo a las 11:30 quedaría entre [cliente A] en Salamanca y [cliente B] en Retiro, evitando un desvío de 8 km"
    }
  ]
}`

  const res = await fetch('/api/groq/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'Eres un optimizador de rutas para técnicos de campo en Madrid. El campo "reasoning" debe ser específico: nombra qué clientes tienen ventana fija y por qué condicionan el orden, qué clientes flexibles se agruparon por zona geográfica, y cuánto tiempo se ahorra frente al orden original. Usa los nombres reales de los clientes y sus calles. El campo "call_suggestions" lista SOLO clientes con ventana_tipo "fija", ordenados por potential_saving_minutes descendente. Para cada uno: (1) calcula cuántos minutos se ganarían si cambian su cita, (2) propone en "suggested_time" la hora concreta a la que debería citarse para encajar mejor en la ruta (ej: "11:30"), (3) explica en "reason" de forma concreta por qué esa hora es mejor — menciona los clientes vecinos con los que se agruparía y el ahorro de distancia. El campo "savings_breakdown" usa estimaciones realistas de Madrid. Responde ÚNICAMENTE con JSON válido, sin texto ni markdown adicional.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1500,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  })

  const data = await res.json()
  if (data.error) throw new Error(data.error.message)

  const raw = data.choices?.[0]?.message?.content || ''

  // JSON mode should return clean JSON, but keep regex fallback
  try {
    return JSON.parse(raw)
  } catch {
    const match = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/)
    if (!match) throw new Error('Respuesta IA no válida. Inténtalo de nuevo.')
    return JSON.parse(match[1])
  }
}

export async function callGroqAPIMultiWorker(apiKey, workers) {
  const workersText = workers
    .map((w, i) => `${i + 1}. ${w.id} | Inicio: ${w.origin} | Horario: ${w.horario}`)
    .join('\n')

  const ordersText = workers
    .flatMap(w =>
      w.orders.map(o =>
        `ID:${o.id} | Cliente:${o.cliente} | Dir:${o.direccion} | Dur:${o.duracion}min | ` +
        `Ventana:${o.ventana_tipo}${o.ventana_inicio ? ` (${o.ventana_inicio}–${o.ventana_fin})` : ''} | ` +
        `Trabajador inicial: ${w.id}`
      )
    )
    .join('\n')

  const prompt = `Optimiza las rutas de estos trabajadores. Puedes reasignar OTs entre trabajadores para equilibrar la carga y minimizar el tiempo total del equipo.

TRABAJADORES:
${workersText}

ÓRDENES (asignación inicial orientativa, puedes reasignar libremente):
${ordersText}

REGLAS:
- Reasigna OTs para que todos los trabajadores terminen a hora similar
- Respeta ventanas "fija": el trabajador asignado debe llegar en esa franja exacta
- Minimiza km totales entre todos los trabajadores
- Cada trabajador sale de su punto de inicio a la hora de inicio de su horario
- saving_minutes por trabajador = ahorro vs su orden original

Devuelve ÚNICAMENTE este JSON (sin texto adicional):
{
  "workers": [
    {
      "trabajador": "Carlos",
      "sequence": [
        {
          "position": 1,
          "ot_id": "OT-XXXX",
          "cliente": "nombre",
          "arrival_time": "09:15",
          "travel_minutes": 15,
          "transport": "coche",
          "window_type": "flexible",
          "window_status": "en hora"
        }
      ],
      "total_km": 24,
      "total_mins_estimated": 180,
      "end_time": "17:30",
      "saving_minutes": 35
    }
  ],
  "global_saving_minutes": 63,
  "global_km": 45,
  "reasoning": "Explicación de qué OTs se reasignaron y por qué, agrupaciones geográficas por trabajador",
  "savings_breakdown": {
    "original_estimated_mins": 420,
    "optimised_mins": 357,
    "original_estimated_km": 88,
    "optimised_km": 45
  },
  "call_suggestions": [
    {
      "ot_id": "OT-XXXX",
      "trabajador": "Carlos",
      "cliente": "nombre",
      "current_window": "09:00–10:00",
      "suggested_time": "11:30",
      "potential_saving_minutes": 18,
      "reason": "Citándolo a las 11:30 quedaría entre [cliente A] y [cliente B], evitando un desvío de X km"
    }
  ]
}`

  const res = await fetch('/api/groq/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'Eres un optimizador de rutas para equipos de técnicos de campo en Madrid. Reasigna órdenes entre trabajadores para minimizar el tiempo total del equipo y equilibrar la carga. Agrupa órdenes geográficamente por trabajador. Respeta siempre las ventanas fijas. Explica en "reasoning" exactamente qué OTs reasignaste, de qué trabajador a cuál, y por qué. Usa nombres reales de clientes y calles. Responde ÚNICAMENTE con JSON válido.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4000,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  })

  const data = await res.json()
  if (data.error) throw new Error(data.error.message)

  const raw = data.choices?.[0]?.message?.content || ''
  try {
    return JSON.parse(raw)
  } catch {
    const match = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/)
    if (!match) throw new Error('Respuesta IA no válida. Inténtalo de nuevo.')
    return JSON.parse(match[1])
  }
}
