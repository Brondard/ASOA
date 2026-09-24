// Ajout à l'agenda : fichier .ics (format standard lu par Apple, Google, Outlook…)
import { CLUB } from '../config.js'
import { download } from './download.js'

const appLink = (hash) => `${window.location.origin}${window.location.pathname}#/${hash}`

// 2026-09-24T17:30:00.000Z -> 20260924T173000Z
const utc = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const day = (iso) => iso.replaceAll('-', '')
const nextDay = (iso) => {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
const escape = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

// Le format impose des lignes de 75 octets max : les suivantes commencent par une espace
function fold(line) {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const out = []
  let cur = ''
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur)
      cur = ''
    }
    cur += ch
  }
  out.push(cur)
  return out.join('\r\n ')
}

function ics(uid, fields) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${CLUB.fullName}//App du club//FR`, 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${uid}@asoa-antibes`, `DTSTAMP:${utc(new Date())}`,
    ...fields.filter(([, v]) => v).map(([k, v]) => `${k}:${v}`),
    'END:VEVENT', 'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

export function addSessionToCalendar(s) {
  const start = new Date(s.starts_at)
  const end = new Date(start.getTime() + (s.duration_min || 60) * 60e3)
  const text = ics(`seance-${s.id}`, [
    ['DTSTART', utc(start)],
    ['DTEND', utc(end)],
    ['SUMMARY', escape(`${CLUB.shortName} · ${s.title}`)],
    ['LOCATION', escape([s.location_name, s.address].filter(Boolean).join(', '))],
    ['DESCRIPTION', escape([s.description, `Séance du club : ${appLink('seances')}`].filter(Boolean).join('\n\n'))],
    ['URL', appLink('seances')],
  ])
  download(`seance-${s.starts_at.slice(0, 10)}.ics`, text, 'text/calendar;charset=utf-8')
}

// Course : événement « journée entière » (l'heure de départ n'est pas connue)
export function addRaceToCalendar(r, label) {
  const text = ics(`course-${r.id}`, [
    ['DTSTART;VALUE=DATE', day(r.race_date)],
    ['DTEND;VALUE=DATE', day(nextDay(r.race_date))],
    ['SUMMARY', escape(label ? `${r.name} · ${label}` : r.name)],
    ['LOCATION', escape(r.location)],
    ['DESCRIPTION', escape([r.description, r.registration_url && `Inscription : ${r.registration_url}`, `Dans l'app : ${appLink(`courses/${r.id}`)}`].filter(Boolean).join('\n\n'))],
    ['URL', appLink(`courses/${r.id}`)],
  ])
  download(`course-${r.race_date}.ics`, text, 'text/calendar;charset=utf-8')
}
