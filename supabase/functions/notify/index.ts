// Edge Function « notify » : envoie les notifications push du club.
//
// Appelée par l'app (coach) :   { type: 'session_new' | 'session_updated' | 'session_cancelled' | 'race_new' | 'results', id }
// Appelée par l'app (tout le monde) : { type: 'test' }  -> notification de test à soi-même
// Appelée par la tâche planifiée : { type: 'daily' } avec l'en-tête x-cron-secret
//
// Secrets à définir (Supabase > Edge Functions > Secrets) :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ex. mailto:contact@asoa.fr), CRON_SECRET, APP_URL
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:contact@example.org',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)
const APP = (Deno.env.get('APP_URL') || '').replace(/\/$/, '')
const link = (hash: string) => `${APP}/#/${hash}`

// ---------- Mise en forme des dates (heure de Paris) ----------
const TZ = 'Europe/Paris'
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, ...o }).format(new Date(d))
const when = (d: string) => `${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })} à ${fmt(d, { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')}`
const hour = (d: string) => fmt(d, { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')

// ---------- Envoi ----------
type Msg = { title: string; body: string; url: string; tag?: string }

async function send(memberIds: string[] | 'all', msg: Msg, exclude?: string) {
  let q = db.from('push_subscriptions').select('id, member_id, endpoint, p256dh, auth')
  if (memberIds !== 'all') {
    if (!memberIds.length) return 0
    q = q.in('member_id', memberIds)
  }
  const { data: subs, error } = await q
  if (error) throw error
  let sent = 0
  await Promise.all((subs || []).filter((s) => s.member_id !== exclude).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg))
      sent++
    } catch (e: any) {
      // Appareil désabonné ou expiré : on le retire
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from('push_subscriptions').delete().eq('id', s.id)
      else console.error('push', e?.statusCode, e?.body)
    }
  }))
  return sent
}

const attendees = async (sessionId: string, statuses = ['yes', 'maybe']) =>
  ((await db.from('session_attendance').select('member_id').eq('session_id', sessionId).in('status', statuses)).data || []).map((r) => r.member_id)

// ---------- Rappels quotidiens (lancés vers 18h) ----------
async function daily() {
  const now = new Date()
  const from = new Date(now.getTime() + 6 * 3600e3)   // séances entre demain 0h et demain 24h (environ)
  const to = new Date(now.getTime() + 30 * 3600e3)
  const { data: sessions } = await db.from('sessions').select('*').eq('cancelled', false)
    .gte('starts_at', from.toISOString()).lt('starts_at', to.toISOString())
  const { data: admins } = await db.from('profiles').select('id').eq('is_admin', true)
  let sent = 0
  for (const s of sessions || []) {
    const yes = await attendees(s.id, ['yes'])
    sent += await send(yes, {
      title: `Demain ${hour(s.starts_at)} · ${s.title}`,
      body: `Rendez-vous ${s.location_name}. ${yes.length} inscrit${yes.length > 1 ? 's' : ''}.`,
      url: link('seances'), tag: `rappel-${s.id}`,
    })
    if (s.min_participants && yes.length < s.min_participants) {
      sent += await send((admins || []).map((a) => a.id), {
        title: `Peu d'inscrits : ${s.title}`,
        body: `${yes.length} inscrit${yes.length > 1 ? 's' : ''} sur ${s.min_participants} minimum pour demain ${hour(s.starts_at)}. Maintenir ou annuler ?`,
        url: link('seances'), tag: `min-${s.id}`,
      })
    }
  }
  // Courses du club dans 7 jours : rappel aux inscrits
  const in7 = new Date(now.getTime() + 7 * 864e5).toLocaleDateString('sv-SE', { timeZone: TZ })
  const { data: races } = await db.from('races').select('*').eq('race_date', in7)
  for (const r of races || []) {
    const going = ((await db.from('race_registrations').select('member_id').eq('race_id', r.id).eq('status', 'going')).data || []).map((x) => x.member_id)
    sent += await send(going, { title: `J-7 : ${r.name}`, body: `Plus qu'une semaine ! ${going.length} ASOA au départ.`, url: link(`resultats/${r.id}`) })
  }
  return sent
}

// ---------- Point d'entrée ----------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { type, id } = await req.json()

    // Tâche planifiée
    if (type === 'daily') {
      if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return json({ error: 'forbidden' }, 403)
      return json({ sent: await daily() })
    }

    // Appels depuis l'app : on identifie l'utilisateur
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    const { data: { user } } = await db.auth.getUser(token)
    if (!user) return json({ error: 'non connecté' }, 401)

    if (type === 'test') {
      return json({ sent: await send([user.id], { title: 'ASOA Antibes', body: 'Les notifications fonctionnent 👍', url: link('seances') }) })
    }

    const { data: me } = await db.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!me?.is_admin) return json({ error: 'réservé aux coachs' }, 403)

    let sent = 0
    if (type === 'session_new' || type === 'session_updated' || type === 'session_cancelled') {
      const { data: s } = await db.from('sessions').select('*').eq('id', id).single()
      if (!s) return json({ error: 'séance introuvable' }, 404)
      if (type === 'session_new') {
        sent = await send('all', { title: `Nouvelle séance · ${s.title}`, body: `${when(s.starts_at)} · ${s.location_name}`, url: link('seances') }, user.id)
      } else if (type === 'session_updated') {
        sent = await send(await attendees(s.id), { title: `Séance modifiée · ${s.title}`, body: `${when(s.starts_at)} · ${s.location_name}`, url: link('seances') }, user.id)
      } else {
        sent = await send(await attendees(s.id), {
          title: `Séance annulée · ${s.title}`,
          body: `${when(s.starts_at)}${s.cancel_reason ? ` — ${s.cancel_reason}` : ''}`,
          url: link('seances'),
        }, user.id)
      }
    } else if (type === 'race_new') {
      const { data: r } = await db.from('races').select('*').eq('id', id).single()
      if (!r) return json({ error: 'course introuvable' }, 404)
      sent = await send('all', {
        title: r.is_club_goal ? `🎯 Objectif club : ${r.name}` : `Nouvelle course : ${r.name}`,
        body: `${fmt(r.race_date, { day: 'numeric', month: 'long', year: 'numeric' })}${r.location ? ` · ${r.location}` : ''}. Tu en es ?`,
        url: link(`resultats/${r.id}`),
      }, user.id)
    } else if (type === 'results') {
      const { data: r } = await db.from('races').select('*').eq('id', id).single()
      if (!r) return json({ error: 'course introuvable' }, 404)
      sent = await send('all', { title: `Résultats en ligne · ${r.name}`, body: 'Découvre les temps des ASOA et les records battus.', url: link(`resultats/${r.id}`) }, user.id)
    } else {
      return json({ error: 'type inconnu' }, 400)
    }
    return json({ sent })
  } catch (e: any) {
    console.error(e)
    return json({ error: String(e?.message || e) }, 500)
  }
})
