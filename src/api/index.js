// Sans variables Supabase (.env), l'app démarre en mode démo avec des données fictives.
import { demoApi } from './demoApi.js'

export const HAS_BACKEND = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

export const api = HAS_BACKEND ? (await import('./supabaseApi.js')).supabaseApi : demoApi
