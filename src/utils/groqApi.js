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
- Ventanas "flexible": reordenar libremente
- Tiempos de desplazamiento en Madrid: 8-25 min en coche, 5-10 min a pie si <700m
- Calcula hora de llegada acumulada para cada parada
- saving_minutes = ahorro vs orden original

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
      "potential_saving_minutes": 18,
      "reason": "Liberando su ventana se ganaría 18 min agrupando con clientes del mismo barrio"
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
          content: 'Eres un optimizador de rutas para técnicos de campo en Madrid. El campo "reasoning" debe ser específico: nombra qué clientes tienen ventana fija y por qué condicionan el orden, qué clientes flexibles se agruparon por zona geográfica, y cuánto tiempo se ahorra frente al orden original. Usa los nombres reales de los clientes y sus calles. El campo "call_suggestions" lista SOLO clientes con ventana_tipo "fija", ordenados por potential_saving_minutes descendente — calcula cuántos minutos se ganarían si ese cliente liberase su ventana. El campo "savings_breakdown" usa estimaciones realistas de Madrid. Responde ÚNICAMENTE con JSON válido, sin texto ni markdown adicional.',
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
