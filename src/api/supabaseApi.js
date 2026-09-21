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
    const { data } = sb().auth.onAuthStateChange(() => cb())
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
  async signOut() {
    await sb().auth.signOut()
  },

  listProfiles: async () => ok(await sb().from('profiles').select('*').order('last_name')),
  updateProfile: async (id, patch) => ok(await sb().from('profiles').update(patch).eq('id', id).select().single()),
  async uploadAvatar(file, userId) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${userId}/avatar-${Date.now()}.${ext}`
    ok(await sb().storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type }))
    return sb().storage.from('avatars').getPublicUrl(path).data.publicUrl
  },

  listSessions: async () => ok(await sb().from('sessions').select('*').order('starts_at')),
  saveSession: async (s) => ok(await sb().from('sessions').upsert(clean(s)).select().single()),
  deleteSession: async (id) => ok(await sb().from('sessions').delete().eq('id', id)),

  listRaces: async () => ok(await sb().from('races').select('*').order('race_date', { ascending: false })),
  saveRace: async (r) => ok(await sb().from('races').upsert(clean(r)).select().single()),
  deleteRace: async (id) => ok(await sb().from('races').delete().eq('id', id)),

  listResults: async () => ok(await sb().from('results').select('*')),
  saveResult: async (r) => ok(await sb().from('results').upsert(clean(r)).select().single()),
  deleteResult: async (id) => ok(await sb().from('results').delete().eq('id', id)),
}
