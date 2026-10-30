// Import d'un calendrier iCalendar (.ics) : export Google Agenda, Outlook, site de course…
// Pensé pour l'agenda du club : emojis en tête de titre, étiquettes [CT] [CR] [FSGT],
// « (a confirmer) », et distances écrites dans la description (« 16km (950m) / 32km (2400m) »).

const unescape = (v) => v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')

// Les lignes longues sont coupées et reprises avec une espace ou une tabulation
function unfold(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '')
}

// DTSTART;VALUE=DATE:20270307  ou  DTSTART;TZID=Europe/Paris:20270307T083000  ou  …T073000Z
function toISODate(value) {
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
    const k = line.slice(0, sep).split(';')[0].toUpperCase()
    const value = line.slice(sep + 1)
    if (k === 'SUMMARY') cur.summary = unescape(value).trim()
    else if (k === 'DESCRIPTION') cur.description = unescape(value).trim()
    else if (k === 'LOCATION') cur.location = unescape(value).trim()
    else if (k === 'URL') cur.url = value.trim()
    else if (k === 'UID') cur.uid = value.trim()
    else if (k === 'DTSTART') cur.date = toISODate(value)
    else if (k === 'STATUS' && /CANCELLED/i.test(value)) cur.cancelled = true
  }
  return events.filter((e) => !e.cancelled).sort((a, b) => a.date.localeCompare(b.date))
}

// ---- Texte : HTML de Google Agenda -> texte simple ------------------------------
export function htmlToText(html = '') {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|td|table)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
    .join('\n')
}

const firstUrl = (s = '') => s.match(/https?:\/\/[^\s"'<>]+/)?.[0]?.replace(/[).,;]+$/, '') || null
const fold = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// « ⛰️[CT][CTL] Trail des Merveilles (a confirmer) » -> nom propre + indices
export function cleanTitle(summary = '') {
  const emojis = summary.match(/^[^\p{L}\p{N}[(]*/u)?.[0] || ''
  const tags = (summary.match(/\[[^\]]+\]/g) || []).map((t) => t.slice(1, -1).toUpperCase())
  // « (a confirmer) », « (à confirmer) », « (Date a confirmer) »
  const TENTATIVE = /\((?:\s*date)?\s*[aà] confirmer\s*\)/gi
  const tentative = TENTATIVE.test(summary)
  const name = summary
    .slice(emojis.length)
    .replace(/\[[^\]]+\]/g, '')
    .replace(TENTATIVE, '')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  return { name, emojis, tags, tentative }
}

// Clé de comparaison : « Trail de l'Énergie » = « trail de l'energie »
export const sameName = (a = '', b = '') => fold(a).replace(/[^a-z0-9]/g, '') === fold(b).replace(/[^a-z0-9]/g, '')

// ---- Discipline -----------------------------------------------------------------
const MULTI = /triathlon|duathlon|aquathlon|swim.?run|ironman|run.?(and|&|n).?bike|bike.?(and|&).?run|\bxterra\b/i
const TRAIL = /trail|ultra|kilom[eè]tre vertical|\bkv\b|verticale|skyrace|utmb|templiers|maxi.?race/i

export function guessDiscipline(title = '', emojis = '', tags = []) {
  if (emojis.includes('🏊') || MULTI.test(title)) return 'triathlon'
  if (/⛰|🧗/u.test(emojis) || tags.some((t) => t === 'CT' || t === 'CTL')) return 'trail'
  // « Urban Trail » marqué 🏃 par le club : c'est de la route
  if (TRAIL.test(title) && !/urban trail/i.test(title)) return 'trail'
  return 'running'
}

// ---- Ce qui n'est pas une course (décoché d'office, le coach peut recocher) --------
export function notARace(name = '', emojis = '') {
  if (emojis.includes('🏟') || /entra[iî]nement|^reprise/i.test(name)) return 'Entraînement'
  if (/🏛|👩‍🏫|🏆|🍽/u.test(emojis) || /assembl[ée]e|soir[ée]e|r[ée]union|buffet|repas|pique.?nique/i.test(name)) return 'Vie du club'
  if (emojis.includes('🏞') || /^sortie\b/i.test(name)) return 'Sortie entre adhérents'
  if (emojis.includes('🧭') || /\bCO\b|orientation/.test(name)) return "Course d'orientation"
  return null
}

// ---- Distances et formats ----------------------------------------------------------
const num = (s) => Number(String(s).replace(',', '.'))
const fr = (n) => String(Math.round(n * 100) / 100).replace('.', ',')

// Distances totales des formats multisport (nage + vélo + course), en km
const MULTI_KM = {
  triathlon: { XS: 12.9, S: 25.75, M: 51.5, L: 113, XL: 226 },
  duathlon: { XS: 13.75, S: 27.5, M: 55 },
  aquathlon: { S: 5.75, M: 11.5 },
}

// Toutes les distances d'un texte : « 9km (125m) / 16km (330m) », « 5.5 et 9 km », « 9,5km 450d+ »
export function distancesIn(text = '') {
  const t = text.replace(/(\d+(?:[.,]\d+)?)\s*(?:et|&)\s*(?=\d+(?:[.,]\d+)?\s*km)/gi, '$1 km ')
  const re = /(?<![\dx.,])(\d{1,3}(?:[.,]\d{1,3})?)\s*(?:kms?|k)\b/gi
  const hits = [...t.matchAll(re)]
  return hits.map((m, i) => {
    const end = m.index + m[0].length
    const after = t.slice(end, hits[i + 1]?.index ?? end + 40)
    // Ce qui précède sur la même ligne depuis la distance d'avant (« Samedi - KV : 4,8km »),
    // et ce qui suit jusqu'au prochain séparateur (« (1000m) KV »)
    const before = t.slice(i ? hits[i - 1].index + hits[i - 1][0].length : 0, m.index).split('\n').pop()
    const own = after.split(/\n|·|\/|\s-\s/)[0]
    const dplus = own.match(/\(\s*(\d{2,5})\s*(?:m|d\+)/i)?.[1] || own.match(/^\s*(\d{2,5})\s*m?\s*d\+/i)?.[1]
    return { km: num(m[1]), dplus: dplus ? Number(dplus) : null, kv: /\bkv\b/i.test(before + ' ' + own) }
  }).filter((d) => d.km > 0 && d.km <= 400)
}

// Formats « Format M / Format L » des triathlons, duathlons, aquathlons
function multiFormats(text, title) {
  const out = []
  for (const m of text.matchAll(/format\s+(XS|S|M|L|XL)\b([^\n/]*)/gi)) {
    const size = m[1].toUpperCase()
    const ctx = fold(m[2] + ' ' + title)
    const sport = /duathlon/.test(ctx) && !/triathlon/.test(fold(m[2])) ? 'duathlon' : /aquathlon/.test(ctx) ? 'aquathlon' : 'triathlon'
    const km = MULTI_KM[sport][size]
    const label = sport === 'triathlon' ? `Distance ${size}` : `${sport[0].toUpperCase()}${sport.slice(1)} ${size}`
    if (!out.some((f) => f.format === label)) out.push({ format: label, distance_km: km ?? '' })
  }
  return out
}

// Distances dans le titre seul (« Corrida de Noël 10k », « Semi-marathon de Nice »)
export function guessFormat(title = '') {
  const t = title.toLowerCase().replace(',', '.')
  if (/\bironman\b(?!.*70)|\bfull\b|\bxxl\b/.test(t)) return { distance_km: 226, format: 'Distance XL' }
  if (/70\.3|half.?ironman/.test(t)) return { distance_km: 113, format: 'Distance L' }
  if (/\bdistance m\b|\bolympique\b/.test(t)) return { distance_km: 51.5, format: 'Distance M' }
  if (/\bdistance s\b|\bsprint\b/.test(t)) return { distance_km: 25.75, format: 'Distance S' }
  if (/semi.?marathon|\bsemi\b|half.?marathon/.test(t)) return { distance_km: 21.1, format: 'Semi-marathon' }
  if (/marathon/.test(t)) return { distance_km: 42.2, format: 'Marathon' }
  const d = distancesIn(t)[0] || (t.match(/(\d{1,3})\s*bornes/) && { km: Number(t.match(/(\d{1,3})\s*bornes/)[1]) })
  if (d) return { distance_km: d.km, format: `${fr(d.km)} km` }
  return {}
}

// Marathon / semi : sur route, ou quand le titre parle de marathon (même si l'épreuve est classée trail)
const roadLike = (discipline, title) => discipline === 'running' || /marathon/i.test(title)

function formatLabel({ km, dplus, kv }, discipline, title) {
  if (roadLike(discipline, title) && !dplus) {
    if (km === 42.2 || km === 42.195) return 'Marathon'
    if (km === 21.1 || km === 21.097) return 'Semi-marathon'
  }
  return `${kv ? 'KV ' : ''}${fr(km)} km${dplus ? ` · ${dplus} D+` : ''}`
}

export function guessFormats(title, text, discipline) {
  const found = []
  for (const d of distancesIn(text)) {
    // Sur route, « 42km » ou « 21km » sans dénivelé : c'est le marathon / le semi
    if (roadLike(discipline, title) && !d.dplus && (d.km === 42 || d.km === 21)) d.km = d.km === 42 ? 42.2 : 21.1
    if (!found.some((f) => f.km === d.km)) found.push(d)
  }
  if (found.length) {
    return found.sort((a, b) => b.km - a.km).map((d) => ({ format: formatLabel(d, discipline, title), distance_km: d.km }))
  }
  const multi = multiFormats(text, title)
  if (multi.length) return multi.sort((a, b) => (Number(b.distance_km) || 0) - (Number(a.distance_km) || 0))
  const g = guessFormat(title)
  return g.distance_km ? [{ format: g.format, distance_km: g.distance_km }] : []
}

// ---- Événements du calendrier -> courses à créer ---------------------------------------
const dayGap = (a, b) => Math.abs(new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 864e5

export function toRaces(events) {
  const rows = events.map((e) => {
    const { name, emojis, tags, tentative } = cleanTitle(e.summary)
    const text = htmlToText(e.description)
    const discipline = guessDiscipline(name, emojis, tags)
    const registration_url = e.url || firstUrl(e.description)
    return {
      uid: e.uid,
      name,
      race_date: e.date,
      location: e.location || null,
      discipline,
      formats: guessFormats(name, text, discipline),
      description: text.replace(/https?:\/\/\S+/g, '').replace(/\n{2,}/g, '\n').trim() || null,
      registration_url,
      is_club_goal: false,
      tentative,
      notRace: notARace(name, emojis),
    }
  })

  // Doublons du calendrier : « X (a confirmer) » + « X » le même jour, ou un week-end saisi
  // sur deux jours. On garde la version confirmée, puis la plus détaillée, puis la première.
  const kept = []
  for (const r of rows) {
    const twin = kept.find((k) => sameName(k.name, r.name) && dayGap(k.race_date, r.race_date) <= 1)
    if (!twin) { kept.push({ ...r, merged: 0 }); continue }
    twin.merged++
    const better = (twin.tentative && !r.tentative) || (twin.tentative === r.tentative && r.formats.length > twin.formats.length)
    if (better) Object.assign(twin, { ...r, race_date: twin.race_date < r.race_date ? twin.race_date : r.race_date, merged: twin.merged })
    else twin.tentative = twin.tentative && r.tentative
  }
  return kept
}
