// Edge Function « ics » : récupère un calendrier .ics par son adresse.
//
// Le navigateur ne peut pas lire directement l'URL de Google Agenda (règles CORS) :
// cette fonction fait la requête côté serveur et renvoie le texte du calendrier.
// Réservée aux coachs. Appelée par l'app : { url: "https://…/basic.ics" }
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const MAX = 2_000_000 // 2 Mo : un calendrier de club est très loin de ça

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    const { data: { user } } = await db.auth.getUser(token)
    if (!user) return json({ error: 'Non connecté.' }, 401)
    const { data: me } = await db.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!me?.is_admin) return json({ error: 'Réservé aux coachs.' }, 403)

    let { url } = await req.json()
    if (typeof url !== 'string') return json({ error: 'Adresse manquante.' }, 400)
    url = url.trim().replace(/^webcal:\/\//i, 'https://')
    let target: URL
    try {
      target = new URL(url)
    } catch {
      return json({ error: "Cette adresse n'est pas valide." }, 400)
    }
    if (target.protocol !== 'https:' && target.protocol !== 'http:') {
      return json({ error: 'Seules les adresses http(s) sont acceptées.' }, 400)
    }

    const res = await fetch(target, { headers: { Accept: 'text/calendar, text/plain' }, redirect: 'follow' })
    if (!res.ok) {
      return json({ error: `Le calendrier n'a pas répondu (erreur ${res.status}). Vérifie qu'il est public.` }, 400)
    }
    const ics = (await res.text()).slice(0, MAX)
    if (!/BEGIN:VCALENDAR/i.test(ics)) {
      return json({ error: "Cette adresse ne renvoie pas un calendrier iCalendar." }, 400)
    }
    return json({ ics })
  } catch (e: any) {
    console.error(e)
    return json({ error: String(e?.message || e) }, 500)
  }
})
