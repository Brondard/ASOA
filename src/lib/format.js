import { CHALLENGE } from '../config.js'

const TZ = 'Europe/Paris'

export const fmtTime = (s) => {
  if (s == null) return 'DNF'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const p = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`
}

// "1:23:45" | "23:45" | "1h23" | "1h23m45" -> secondes
export const parseTime = (str) => {
  if (!str) return null
  const t = str.trim().toLowerCase().replace(/[hm]/g, ':').replace(/s$/, '').replace(/:$/, '')
  const parts = t.split(':').map((x) => parseInt(x, 10))
  if (parts.some(isNaN)) return undefined
  let s = 0
  if (parts.length === 3) s = parts[0] * 3600 + parts[1] * 60 + parts[2]
  else if (parts.length === 2) s = /h/.test(str) ? parts[0] * 3600 + parts[1] * 60 : parts[0] * 60 + parts[1]
  else return undefined
  return s > 0 ? s : undefined
}

export const pace = (seconds, km) => {
  if (!seconds || !km) return null
  const p = seconds / km
  return `${Math.floor(p / 60)}'${String(Math.round(p % 60)).padStart(2, '0')}/km`
}

const f = (opts) => new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, ...opts })
export const dayName = (d) => f({ weekday: 'short' }).format(new Date(d)).replace('.', '')
export const dayNum = (d) => f({ day: 'numeric' }).format(new Date(d))
export const monthShort = (d) => f({ month: 'short' }).format(new Date(d)).replace('.', '')
export const hour = (d) => f({ hour: '2-digit', minute: '2-digit' }).format(new Date(d)).replace(':', 'h')
export const longDate = (d) => f({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d))
export const fullDate = (d) => f({ day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d))

export const km = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n)

// Saison sportive : "2025-2026" pour une date entre sept. 2025 et août 2026
export const seasonOf = (date) => {
  const d = new Date(date)
  const y = d.getMonth() >= CHALLENGE.seasonStartMonth ? d.getFullYear() : d.getFullYear() - 1
  return `${y}-${y + 1}`
}

export const fullName = (p) => (p ? `${p.first_name} ${p.last_name}`.trim() : '—')
export const initials = (p) => ((p?.first_name?.[0] || '') + (p?.last_name?.[0] || '')).toUpperCase()

export const mapsUrl = (s) =>
  s.lat && s.lng
    ? `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([s.location_name, s.address].filter(Boolean).join(', '))}`

// datetime-local <-> ISO
export const toLocalInput = (iso) => {
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
