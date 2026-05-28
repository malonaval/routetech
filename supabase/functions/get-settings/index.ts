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

  const { data, error } = await supabase
    .from('user_settings')
    .select('groq_api_key, google_maps_key, consumption, fuel_price')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return new Response(
    JSON.stringify({ error: error.message }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
  if (!data) return new Response(
    JSON.stringify({}),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )

  const result = {
    groq_api_key:    await decryptIfPresent(data.groq_api_key),
    google_maps_key: await decryptIfPresent(data.google_maps_key),
    consumption:     data.consumption,
    fuel_price:      data.fuel_price,
  }

  return new Response(
    JSON.stringify(result),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
