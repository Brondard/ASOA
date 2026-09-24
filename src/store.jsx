import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api/index.js'

const Ctx = createContext(null)
export const useData = () => useContext(Ctx)

const EMPTY = { ready: false, me: null, profiles: [], pending: [], sessions: [], races: [], results: [], attendance: [], registrations: [] }
// approved absent = migration v5 pas encore passée : on ne bloque personne
export const isMember = (p) => !!p && (p.approved !== false || p.is_admin)

export function DataProvider({ children }) {
  const [state, setState] = useState(EMPTY)
  const [toast, setToast] = useState(null)
  // Arrivée depuis le lien « mot de passe oublié » : on demande le nouveau mot de passe
  const [recovery, setRecovery] = useState(() => /type=(recovery|invite)/.test(window.location.hash))

  const load = useCallback(async () => {
    try {
      const me = await api.currentUser()
      if (!me) return setState((s) => ({ ...s, ready: true, me: null }))
      // Compte pas encore validé : la base ne lui renvoie rien, inutile de charger
      if (!isMember(me)) return setState({ ...EMPTY, ready: true, me })
      const [all, sessions, races, results, attendance, registrations] = await Promise.all([
        api.listProfiles(), api.listSessions(), api.listRaces(), api.listResults(),
        api.listAttendance(), api.listRegistrations(),
      ])
      // Les comptes en attente n'apparaissent nulle part, sauf dans l'onglet Coachs
      const profiles = all.filter(isMember)
      const pending = all.filter((p) => !isMember(p))
      setState({ ready: true, me, profiles, pending, sessions, races, results, attendance, registrations })
    } catch (e) {
      setState((s) => ({ ...s, ready: true }))
      setToast({ text: e.message, error: true })
    }
  }, [])

  useEffect(() => {
    load()
    return api.onAuthChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      load()
    })
  }, [load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(t)
  }, [toast])

  // Exécute une action, recharge les données, affiche un message
  const run = useCallback(async (fn, successText) => {
    try {
      const out = await fn()
      await load()
      if (successText) setToast({ text: successText })
      return out ?? true
    } catch (e) {
      setToast({ text: e.message, error: true })
      return false
    }
  }, [load])

  // Réponse instantanée à l'écran, puis enregistrement (on recharge si ça échoue)
  const optimistic = useCallback(async (key, match, status, save) => {
    setState((s) => {
      const rest = s[key].filter((x) => !Object.entries(match).every(([k, v]) => x[k] === v))
      return { ...s, [key]: status ? [...rest, { ...match, status }] : rest }
    })
    try {
      await save()
    } catch (e) {
      setToast({ text: e.message, error: true })
      load()
    }
  }, [load])

  const setAttendance = (session_id, status) =>
    optimistic('attendance', { session_id, member_id: state.me.id }, status, () => api.setAttendance(session_id, state.me.id, status))
  const setRegistration = (race_id, status) =>
    optimistic('registrations', { race_id, member_id: state.me.id }, status, () => api.setRegistration(race_id, state.me.id, status))

  // Envoi d'une notification push (coach) : n'empêche jamais l'action principale
  const notify = useCallback(async (type, id) => {
    try {
      const r = await api.notify(type, id)
      setToast({ text: r?.demo ? 'Notification envoyée (simulée en démo)' : `Notification envoyée à ${r?.sent ?? 0} appareil${r?.sent > 1 ? 's' : ''}` })
    } catch (e) {
      setToast({ text: e.message, error: true })
    }
  }, [])

  const isAdmin = !!state.me?.is_admin
  return (
    <Ctx.Provider value={{ ...state, isAdmin, reload: load, run, toast, setToast, setAttendance, setRegistration, notify, recovery, setRecovery }}>
      {children}
    </Ctx.Provider>
  )
}

// Routage minimal par hash : #/courses/r-001
export function useRoute() {
  const get = () => (window.location.hash.replace(/^#\/?/, '') || 'seances').split('/')
  const [route, setRoute] = useState(get)
  useEffect(() => {
    const on = () => {
      setRoute(get())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export const go = (path) => {
  window.location.hash = `/${path}`
}
