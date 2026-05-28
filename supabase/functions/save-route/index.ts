import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { encryptIfPresent } from '../_shared/crypto.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const body = await req.json()

  // Insertar ruta
  const { data: route, error: routeErr } = await supabase
    .from('routes')
    .insert({
      user_id:        user.id,
      origin:         await encryptIfPresent(body.origin),
      total_km:       body.total_km,
      saving_minutes: body.saving_minutes,
      end_time:       body.end_time,
      worker_count:   body.worker_count ?? 1,
    })
    .select('id')
    .single()

  if (routeErr) return new Response(
    JSON.stringify({ error: routeErr.message }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )

  // Insertar paradas con PII cifrado
  const stops = await Promise.all(
    (body.stops ?? []).map(async (s: Record<string, unknown>) => ({
      route_id:       route.id,
      position:       s.position,
      client_name:    await encryptIfPresent(s.client_name as string),
      client_address: await encryptIfPresent(s.client_address as string),
      client_phone:   await encryptIfPresent(s.client_phone as string),
      duration_min:   s.duration_min,
      window_type:    s.window_type,
      window_start:   s.window_start,
      window_end:     s.window_end,
      arrival_time:   s.arrival_time,
      travel_minutes: s.travel_minutes,
    }))
  )

  const { error: stopsErr } = await supabase.from('route_stops').insert(stops)
  if (stopsErr) return new Response(
    JSON.stringify({ error: stopsErr.message }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )

  return new Response(
    JSON.stringify({ route_id: route.id }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
