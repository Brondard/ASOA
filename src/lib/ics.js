// Lecture d'un calendrier iCalendar (.ics) — export Google Agenda, Outlook, site de course…
// On ne garde que ce qui sert à créer une course : titre, date, lieu, description, lien.

const unescape = (v) => v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')

// Les lignes longues sont coupées et reprises avec une espace ou une tabulation
function unfold(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '')
}

// DTSTART;VALUE=DATE:20270307  ou  DTSTART;TZID=Europe/Paris:20270307T083000  ou  …T073000Z
function toISODate(value, params) {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/)
  if (!m) return null
  const [, y, mo, d, hh, mm, ss, z] = m
  // Heure en UTC : on repasse en heure locale, sinon une course à 8h du matin peut basculer la veille
  if (z && hh) return new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss)).toLocaleDateString('sv-SE')
  return `${y}-${mo}-${d}`
}

export function parseIcs(text) {
  if (!text || !/BEGIN:VCALENDAR/i.test(text)) {
    throw new Error("Ce fichier n'est pas un calendrier iCalendar (.ics).")
  }
  const events = []
  let cur = null
  for (const line of unfold(text).split('\n')) {
    if (/^BEGIN:VEVENT/i.test(line)) { cur = {}; continue }
    if (/^END:VEVENT/i.test(line)) {
      if (cur?.date && cur.summary) events.push(cur)
      cur = null
      continue
    }
    if (!cur) continue
    const sep = line.indexOf(':')
    if (sep < 0) continue
    const rawKey = line.slice(0, sep)
    const value = line.slice(sep + 1)
    const [key, ...params] = rawKey.split(';')
    const k = key.toUpperCase()
    if (k === 'SUMMARY') cur.summary = unescape(value).trim()
    else if (k === 'DESCRIPTION') cur.description = unescape(value).trim()
    else if (k === 'LOCATION') cur.location = unescape(value).trim()
    else if (k === 'URL') cur.url = value.trim()
    else if (k === 'UID') cur.uid = value.trim()
    else if (k === 'DTSTART') cur.date = toISODate(value, params)
    else if (k === 'STATUS' && /CANCELLED/i.test(value)) cur.cancelled = true
  }
  return events
    .filter((e) => !e.cancelled)
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ---- Devine la discipline et la distance à partir du titre -------------------
const TRAIL = /\btrail|ultra|kilom[eè]tre vertical|\bkv\b|skyrace|utmb|templiers|maxi.?race/i
const TRI = /triathlon|ironman|\bim\b70|duathlon|aquathlon|swimrun|\bxterra/i

export function guessDiscipline(title = '') {
  if (TRI.test(title)) return 'triathlon'
  if (TRAIL.test(title)) return 'trail'
  return 'running'
}

// Renvoie { distance_km, format } ou {} si on ne devine rien
export function guessFormat(title = '') {
  const t = title.toLowerCase().replace(',', '.')

  if (/\bironman\b(?!.*70)|\bfull\b|\bxxl\b/.test(t)) return { distance_km: 226, format: 'Distance XXL' }
  if (/70\.3|half.?ironman|\bhalf\b/.test(t) && TRI.test(title)) return { distance_km: 113, format: 'Distance L' }
  if (/\bdistance m\b|\bolympique\b/.test(t)) return { distance_km: 51.5, format: 'Distance M' }
  if (/\bdistance s\b|\bsprint\b/.test(t)) return { distance_km: 25.75, format: 'Distance S' }
  if (/semi.?marathon|\bsemi\b|half.?marathon/.test(t)) return { distance_km: 21.1, format: 'Semi-marathon' }
  if (/marathon|ekiden/.test(t)) return { distance_km: 42.2, format: 'Marathon' }

  // « 24 km », « 24km », « 10 k », « 15,5 km »
  const km = t.match(/(\d{1,3}(?:\.\d{1,2})?)\s?(?:km|k\b)/)
  if (km) {
    const d = Number(km[1])
    if (d > 0 && d <= 400) return { distance_km: d, format: `${km[1].replace('.', ',')} km` }
  }
  const miles = t.match(/(\d{1,3})\s?miles?\b/)
  if (miles) return { distance_km: Math.round(Number(miles[1]) * 1.609 * 10) / 10, format: `${miles[1]} miles` }
  return {}
}

// Transforme les événements du calendrier en courses prêtes à créer
export function toRaces(events) {
  return events.map((e) => {
    const discipline = guessDiscipline(e.summary)
    const { distance_km, format } = guessFormat(e.summary)
    return {
      uid: e.uid,
      name: e.summary,
      race_date: e.date,
      location: e.location || null,
      discipline,
      format: format || null,
      distance_km: distance_km ?? '',
      description: e.description || null,
      registration_url: e.url || null,
      is_club_goal: false,
    }
  })
}
