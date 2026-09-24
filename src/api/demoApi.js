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

// Même effet que la cascade SQL de la vraie base
function removeMember(id) {
  db.profiles = db.profiles.filter((p) => p.id !== id)
  db.results = db.results.filter((x) => x.member_id !== id)
  db.attendance = db.attendance.filter((x) => x.member_id !== id)
  db.registrations = db.registrations.filter((x) => x.member_id !== id)
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
    currentId = { admin: 'm-000', pending: 'm-900' }[role] || 'm-001'
    emit()
  },
  async updatePassword() {},
  async signOut() {
    currentId = null
    emit()
  },

  listProfiles: () => wait(db.profiles),
  updateProfile: (id, patch) => upsert('profiles', { id, ...patch }),
  setCoach: (id, value) => upsert('profiles', { id, is_admin: value }),
  approveMember: (id) => upsert('profiles', { id, approved: true }),
  async refuseMember(id) {
    removeMember(id)
  },
  async deleteMyAccount(id) {
    const p = db.profiles.find((x) => x.id === id)
    if (p?.is_admin && db.profiles.filter((x) => x.is_admin).length === 1) {
      throw new Error('Tu es le seul coach : nomme un autre coach avant de supprimer ton compte.')
    }
    removeMember(id)
    currentId = null
    emit()
  },
  createGuest: ({ first_name, last_name }) =>
    upsert('profiles', { first_name, last_name, avatar_url: null, city: null, disciplines: [], is_admin: false, vma: null, approved: true, guest: true }, 'g'),
  async deleteGuest(id) {
    removeMember(id)
  },
  // Même logique que la fonction SQL link_guest
  async linkGuest(guestId, accountId) {
    const g = db.profiles.find((p) => p.id === guestId)
    const move = (rows, key) => rows.map((r) => (r.member_id === guestId && !rows.some((x) => x.member_id === accountId && x[key] === r[key]) ? { ...r, member_id: accountId } : r))
    db.results = move(db.results, 'race_id')
    db.registrations = move(db.registrations, 'race_id')
    db.attendance = move(db.attendance, 'session_id')
    db.profiles = db.profiles.map((p) => (p.id !== accountId ? p : {
      ...p, approved: true, city: p.city || g.city, disciplines: p.disciplines.length ? p.disciplines : g.disciplines,
      vma: p.vma ?? g.vma, avatar_url: p.avatar_url ?? g.avatar_url,
    }))
    removeMember(guestId)
  },
  myEmail: async () => (currentId ? `${currentId}@demo.asoa` : null),
  async uploadAvatar(file) {
    return new Promise((res) => {
      const r = new FileReader()
      r.onload = () => res(r.result)
      r.readAsDataURL(file)
    })
  },

  listSessions: () => wait([...db.sessions].sort((a, b) => a.starts_at.localeCompare(b.starts_at))),
  saveSession: (s) => upsert('sessions', s, 's'),
  updateSession: (id, patch) => upsert('sessions', { id, ...patch }),
  async deleteSession(id) {
    db.sessions = db.sessions.filter((s) => s.id !== id)
    db.attendance = db.attendance.filter((a) => a.session_id !== id)
  },

  listRaces: () => wait([...db.races].sort((a, b) => b.race_date.localeCompare(a.race_date))),
  saveRace: (r) => upsert('races', r, 'r'),
  async deleteRace(id) {
    db.races = db.races.filter((r) => r.id !== id)
    db.results = db.results.filter((x) => x.race_id !== id)
    db.registrations = db.registrations.filter((x) => x.race_id !== id)
  },

  async moveRaceContent(fromId, toId) {
    db.results = db.results.map((r) => (r.race_id === fromId ? { ...r, race_id: toId } : r))
    db.registrations = db.registrations.map((r) => (r.race_id === fromId ? { ...r, race_id: toId } : r))
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

  listAttendance: () => wait(db.attendance),
  async setAttendance(session_id, member_id, status) {
    db.attendance = db.attendance.filter((a) => !(a.session_id === session_id && a.member_id === member_id))
    if (status) db.attendance.push({ session_id, member_id, status })
  },
  listRegistrations: () => wait(db.registrations),
  async setRegistration(race_id, member_id, status) {
    db.registrations = db.registrations.filter((a) => !(a.race_id === race_id && a.member_id === member_id))
    if (status) db.registrations.push({ race_id, member_id, status })
  },
  async savePushSubscription() {},
  async deletePushSubscription() {},
  async notify() {
    return { sent: 0, demo: true }
  },

  reset() {
    db = buildDemo()
  },
}
