import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { decryptIfPresent } from '../_shared/crypto.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const { data: routes, error } = await supabase
    .from('routes')
    .select(`
      id, created_at, origin, total_km, saving_minutes, end_time, worker_count,
      route_stops (
        position, client_name, client_address, client_phone,
        duration_min, window_type, window_start, window_end,
        arrival_time, travel_minutes
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return new Response(
    JSON.stringify({ error: error.message }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )

  // Descifrar PII en cada ruta y parada
  const decrypted = await Promise.all((routes ?? []).map(async (route) => ({
    ...route,
    origin: await decryptIfPresent(route.origin),
    route_stops: await Promise.all((route.route_stops ?? []).map(async (s) => ({
      ...s,
      client_name:    await decryptIfPresent(s.client_name),
      client_address: await decryptIfPresent(s.client_address),
      client_phone:   await decryptIfPresent(s.client_phone),
    }))),
  })))

  return new Response(
    JSON.stringify(decrypted),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
