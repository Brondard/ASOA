import { createClient } from '@supabase/supabase-js'

// Client créé à la première utilisation (le mode démo n'en a jamais besoin)
let client
const sb = () => (client ||= createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY))

const ok = ({ data, error }) => {
  if (error) throw new Error(translate(error.message))
  return data
}

function translate(msg) {
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou mot de passe incorrect.'
  if (/Email not confirmed/i.test(msg)) return 'Confirme ton e-mail avant de te connecter (regarde tes spams).'
  if (/User already registered/i.test(msg)) return 'Un compte existe déjà avec cet e-mail.'
  if (/Password should be at least/i.test(msg)) return 'Le mot de passe doit faire au moins 6 caractères.'
  if (/duplicate key.*results_race_id_member_id/i.test(msg)) return 'Cet adhérent a déjà un résultat sur cette course.'
  if (/row-level security/i.test(msg)) return 'Action réservée aux coachs.'
  return msg
}

// Supabase renvoie 1000 lignes max par requête : on pagine
async function fetchAll(build) {
  const size = 1000
  let from = 0
  const out = []
  for (;;) {
    const page = ok(await build().range(from, from + size - 1))
    out.push(...page)
    if (page.length < size) return out
    from += size
  }
}

// Photos de profil d'un compte (dossier <id>/ du bucket avatars)
async function removeAvatars(userId) {
  const files = ok(await sb().storage.from('avatars').list(userId))
  if (files.length) ok(await sb().storage.from('avatars').remove(files.map((f) => `${userId}/${f.name}`)))
}

// Retire les champs vides/non persistés avant écriture
const clean = (row) => {
  const out = { ...row }
  if (!out.id) delete out.id
  return out
}

export const supabaseApi = {
  isDemo: false,

  async currentUser() {
    const { data } = await sb().auth.getSession()
    const uid = data.session?.user?.id
    if (!uid) return null
    return ok(await sb().from('profiles').select('*').eq('id', uid).single())
  },
  onAuthChange(cb) {
    const { data } = sb().auth.onAuthStateChange((event) => cb(event))
    return () => data.subscription.unsubscribe()
  },
  async signIn(email, password) {
    ok(await sb().auth.signInWithPassword({ email, password }))
  },
  async signUp({ email, password, first_name, last_name }) {
    const data = ok(await sb().auth.signUp({
      email, password,
      options: { data: { first_name, last_name }, emailRedirectTo: window.location.origin },
    }))
    return { needsConfirmation: !data.session }
  },
  async resetPassword(email) {
    ok(await sb().auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }))
  },
  async updatePassword(password) {
    ok(await sb().auth.updateUser({ password }))
  },
  async signOut() {
    await sb().auth.signOut()
  },

  listProfiles: async () => ok(await sb().from('profiles').select('*').order('last_name')),
  updateProfile: async (id, patch) => ok(await sb().from('profiles').update(patch).eq('id', id).select().single()),
  // Le trigger protect_admin_flag annule le changement sans erreur si on n'est pas coach : on vérifie
  async setCoach(id, value) {
    const row = ok(await sb().from('profiles').update({ is_admin: value }).eq('id', id).select().single())
    if (row.is_admin !== value) throw new Error('Action réservée aux coachs.')
    return row
  },
  async approveMember(id) {
    const row = ok(await sb().from('profiles').update({ approved: true }).eq('id', id).select().single())
    if (!row.approved) throw new Error('Action réservée aux coachs.')
    return row
  },
  // Refus d'une inscription en attente : photo puis compte (cascade sur tout le reste)
  async refuseMember(id) {
    await removeAvatars(id)
    ok(await sb().rpc('refuse_member', { p_id: id }))
  },
  async deleteMyAccount(id) {
    await removeAvatars(id)
    ok(await sb().rpc('delete_my_account'))
    await sb().auth.signOut({ scope: 'local' })
  },
  async myEmail() {
    const { data } = await sb().auth.getSession()
    return data.session?.user?.email || null
  },
  async uploadAvatar(file, userId) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${userId}/avatar-${Date.now()}.${ext}`
    ok(await sb().storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type }))
    return sb().storage.from('avatars').getPublicUrl(path).data.publicUrl
  },

  listSessions: async () => ok(await sb().from('sessions').select('*').order('starts_at')),
  saveSession: async (s) => ok(await sb().from('sessions').upsert(clean(s)).select().single()),
  updateSession: async (id, patch) => ok(await sb().from('sessions').update(patch).eq('id', id).select().single()),
  deleteSession: async (id) => ok(await sb().from('sessions').delete().eq('id', id)),

  listRaces: async () => ok(await sb().from('races').select('*').order('race_date', { ascending: false })),
  saveRace: async (r) => ok(await sb().from('races').upsert(clean(r)).select().single()),
  deleteRace: async (id) => ok(await sb().from('races').delete().eq('id', id)),
  // Rattache résultats et inscriptions d'une course à une autre (conversion en épreuve à formats)
  async moveRaceContent(fromId, toId) {
    ok(await sb().from('results').update({ race_id: toId }).eq('race_id', fromId))
    ok(await sb().from('race_registrations').update({ race_id: toId }).eq('race_id', fromId))
  },

  listResults: () => fetchAll(() => sb().from('results').select('*').order('id')),
  saveResult: async (r) => ok(await sb().from('results').upsert(clean(r)).select().single()),
  deleteResult: async (id) => ok(await sb().from('results').delete().eq('id', id)),

  // Présences aux séances
  listAttendance: () => fetchAll(() => sb().from('session_attendance').select('session_id, member_id, status').order('session_id').order('member_id')),
  async setAttendance(session_id, member_id, status) {
    if (!status) return ok(await sb().from('session_attendance').delete().match({ session_id, member_id }))
    ok(await sb().from('session_attendance').upsert({ session_id, member_id, status, updated_at: new Date().toISOString() }))
  },

  // Inscriptions aux courses
  listRegistrations: () => fetchAll(() => sb().from('race_registrations').select('race_id, member_id, status').order('race_id').order('member_id')),
  async setRegistration(race_id, member_id, status) {
    if (!status) return ok(await sb().from('race_registrations').delete().match({ race_id, member_id }))
    ok(await sb().from('race_registrations').upsert({ race_id, member_id, status }))
  },

  // Notifications push
  async savePushSubscription(sub) {
    const j = sub.toJSON()
    ok(await sb().rpc('save_push_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth }))
  },
  async deletePushSubscription(endpoint) {
    ok(await sb().from('push_subscriptions').delete().eq('endpoint', endpoint))
  },
  // Demande à l'Edge Function "notify" d'envoyer une notification
  async notify(type, id) {
    const { data, error } = await sb().functions.invoke('notify', { body: { type, id } })
    if (error) throw new Error('Notification non envoyée : la fonction « notify » n\'est pas encore déployée ou a échoué.')
    return data
  },
}
