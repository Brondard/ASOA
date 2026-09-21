import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api/index.js'

const Ctx = createContext(null)
export const useData = () => useContext(Ctx)

export function DataProvider({ children }) {
  const [state, setState] = useState({ ready: false, me: null, profiles: [], sessions: [], races: [], results: [] })
  const [toast, setToast] = useState(null)

  const load = useCallback(async () => {
    try {
      const me = await api.currentUser()
      if (!me) return setState((s) => ({ ...s, ready: true, me: null }))
      const [profiles, sessions, races, results] = await Promise.all([
        api.listProfiles(), api.listSessions(), api.listRaces(), api.listResults(),
      ])
      setState({ ready: true, me, profiles, sessions, races, results })
    } catch (e) {
      setState((s) => ({ ...s, ready: true }))
      setToast({ text: e.message, error: true })
    }
  }, [])

  useEffect(() => {
    load()
    return api.onAuthChange(load)
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

  const isAdmin = !!state.me?.is_admin
  return <Ctx.Provider value={{ ...state, isAdmin, reload: load, run, toast, setToast }}>{children}</Ctx.Provider>
}

// Routage minimal par hash : #/resultats/r-001
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
