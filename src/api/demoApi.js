// Mode démo : même interface que supabaseApi, données en mémoire.
import { buildDemo } from './demoData.js'

let db = buildDemo()
let currentId = null
const listeners = new Set()
const emit = () => listeners.forEach((cb) => cb())
const newId = (p) => `${p}-${Math.random().toString(36).slice(2, 9)}`
const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 120))

function upsert(table, row, prefix) {
  if (row.id) {
    db[table] = db[table].map((r) => (r.id === row.id ? { ...r, ...row } : r))
    return wait(db[table].find((r) => r.id === row.id))
  }
  const created = { ...row, id: newId(prefix) }
  db[table] = [...db[table], created]
  return wait(created)
}

export const demoApi = {
  isDemo: true,

  async currentUser() {
    return currentId ? wait(db.profiles.find((p) => p.id === currentId)) : null
  },
  onAuthChange(cb) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  },
  async signIn() {
    throw new Error('Mode démo : utilise les boutons « Démo adhérent » ou « Démo coach ».')
  },
  async signUp() {
    throw new Error('Mode démo : l\'inscription sera active une fois la base Supabase branchée.')
  },
  async resetPassword() {
    throw new Error('Mode démo : pas d\'envoi d\'e-mail.')
  },
  demoSignIn(role) {
    currentId = role === 'admin' ? 'm-000' : 'm-001'
    emit()
  },
  async signOut() {
    currentId = null
    emit()
  },

  listProfiles: () => wait(db.profiles),
  updateProfile: (id, patch) => upsert('profiles', { id, ...patch }),
  async uploadAvatar(file) {
    return new Promise((res) => {
      const r = new FileReader()
      r.onload = () => res(r.result)
      r.readAsDataURL(file)
    })
  },

  listSessions: () => wait([...db.sessions].sort((a, b) => a.starts_at.localeCompare(b.starts_at))),
  saveSession: (s) => upsert('sessions', s, 's'),
  async deleteSession(id) {
    db.sessions = db.sessions.filter((s) => s.id !== id)
  },

  listRaces: () => wait([...db.races].sort((a, b) => b.race_date.localeCompare(a.race_date))),
  saveRace: (r) => upsert('races', r, 'r'),
  async deleteRace(id) {
    db.races = db.races.filter((r) => r.id !== id)
    db.results = db.results.filter((x) => x.race_id !== id)
  },

  listResults: () => wait(db.results),
  async saveResult(r) {
    const dup = db.results.find((x) => x.race_id === r.race_id && x.member_id === r.member_id && x.id !== r.id)
    if (dup) throw new Error('Cet adhérent a déjà un résultat sur cette course.')
    return upsert('results', r, 'x')
  },
  async deleteResult(id) {
    db.results = db.results.filter((x) => x.id !== id)
  },

  reset() {
    db = buildDemo()
  },
}
