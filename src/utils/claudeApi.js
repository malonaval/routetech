export async function callClaudeAPI(apiKey, origin, orders) {
  const ordersText = orders
    .map(
      (o, i) =>
        `${i + 1}. ID:${o.id} | Cliente:${o.cliente} | Dir:${o.direccion} | ` +
        `Dur:${o.duracion}min | Ventana:${o.ventana_tipo}` +
        (o.ventana_inicio ? ` (${o.ventana_inicio}–${o.ventana_fin})` : '')
    )
    .join('\n')

  const prompt = `Eres un optimizador de rutas para técnicos de campo en Madrid, España.
Ordena estas órdenes de trabajo minimizando tiempo total de desplazamiento, respetando ventanas fijas.

INICIO: ${origin} · HORA INICIO: 09:00

ÓRDENES:
${ordersText}

REGLAS:
- Ventanas "fija": cumplir en la franja exacta
- Ventanas "flexible": reordenar libremente
- Tiempos de desplazamiento en Madrid: 8-25 min en coche, 5-10 min a pie si <700m
- Calcula hora de llegada acumulada para cada parada
- El campo "saving_minutes" es el ahorro real vs el orden original (sin optimizar)

Responde SOLO con JSON válido:
\`\`\`json
{
  "saving_minutes": 40,
  "total_km": 24,
  "end_time": "19:00",
  "reasoning": "2-3 frases explicando la lógica aplicada",
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
  ]
}
\`\`\``

  // Llamada a través del proxy de Vite (evita CORS)
  const res = await fetch('/api/claude/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await res.json()
  if (data.error) throw new Error(data.error.message)

  const raw = data.content?.[0]?.text || ''
  const match = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/)
  if (!match) throw new Error('Respuesta IA no válida. Inténtalo de nuevo.')
  return JSON.parse(match[1])
}
