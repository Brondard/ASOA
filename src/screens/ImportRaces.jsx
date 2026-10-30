import { useMemo, useRef, useState } from 'react'
import { api } from '../api/index.js'
import { DISCIPLINES } from '../config.js'
import { fullDate, todayISO } from '../lib/format.js'
import { parseIcs, sameName, toRaces } from '../lib/ics.js'
import { topRaces } from '../lib/events.js'
import { useData } from '../store.jsx'
import { Empty, Field, Icon, Sheet } from '../ui.jsx'

const SOURCES = [['file', 'Fichier .ics'], ['url', 'Lien du calendrier'], ['text', 'Coller le texte']]
const num = (v) => Number(String(v).replace(',', '.'))
const dayGap = (a, b) => Math.abs(new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 864e5

export default function ImportRaces({ onClose }) {
  const { races, run } = useData()
  const [source, setSource] = useState('file')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [rows, setRows] = useState(null) // null = pas encore lu
  const [showPast, setShowPast] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [err, setErr] = useState('')
  const fileInput = useRef()

  const read = (ics) => {
    try {
      const found = toRaces(parseIcs(ics))
      if (!found.length) return setErr('Aucun événement trouvé dans ce calendrier.')
      setErr('')
      // Déjà dans l'app : même nom (aux accents et majuscules près), à un jour près
      const existing = topRaces(races)
      setRows(found.map((r) => {
        const exists = existing.some((x) => sameName(x.name, r.name) && dayGap(x.race_date, r.race_date) <= 1)
        const past = r.race_date < todayISO()
        return { ...r, exists, past, keep: !exists && !past && !r.notRace && !r.tentative }
      }))
    } catch (e) {
      setErr(e.message)
    }
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (file) read(await file.text())
  }

  const loadUrl = async () => {
    setBusy(true)
    setErr('')
    try {
      read(await api.fetchIcs(url.trim()))
    } catch (e) {
      setErr(e.message)
    }
    setBusy(false)
  }

  const set = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const setFormat = (i, k, patch) => set(i, { formats: rows[i].formats.map((f, j) => (j === k ? { ...f, ...patch } : f)) })
  const chosen = useMemo(() => (rows || []).filter((r) => r.keep), [rows])
  const visible = (rows || []).map((r, i) => [r, i]).filter(([r]) => showPast || !r.past || r.keep)
  const hiddenPast = (rows || []).filter((r) => r.past && !r.keep).length

  // La liste est longue : on amène le coach directement sur le champ à corriger
  const fail = (text, fieldId) => {
    setErr(text)
    setTimeout(() => document.getElementById(fieldId)?.focus(), 0)
  }

  const submit = async () => {
    for (const r of chosen) {
      const i = rows.indexOf(r)
      if (!r.name.trim()) return fail('Une course cochée n\'a pas de nom.', `imp-name-${i}`)
      if (!r.formats.length) return fail(`Ajoute au moins une distance à « ${r.name} » : elle sert au challenge.`, `imp-${i}`)
      const k = r.formats.findIndex((f) => !String(f.distance_km).trim() || isNaN(num(f.distance_km)) || num(f.distance_km) <= 0)
      if (k >= 0) return fail(`Distance manquante pour « ${r.name}${r.formats[k].format ? ` · ${r.formats[k].format}` : ''} ».`, `imp-km-${i}-${k}`)
      const n = r.formats.findIndex((f) => !f.format.trim())
      if (r.formats.length > 1 && n >= 0) return fail(`Donne un nom à chaque format de « ${r.name} ».`, `imp-fmt-${i}-${n}`)
    }
    setErr('')
    const n = chosen.length
    // Un import peut prendre un moment : bouton bloqué (sinon un double clic importe tout deux fois)
    setBusy(true)
    const ok = await run(async () => {
      for (const [done, r] of chosen.entries()) {
        setProgress(done + 1)
        const shared = {
          name: r.name.trim(), race_date: r.race_date, location: r.location, discipline: r.discipline,
          description: r.description, registration_url: r.registration_url, is_club_goal: false,
        }
        // Même structure que le formulaire « + Course » : course simple, ou épreuve + une ligne par format
        if (r.formats.length === 1) {
          await api.saveRace({ ...shared, parent_id: null, format: r.formats[0].format || null, distance_km: num(r.formats[0].distance_km) })
          continue
        }
        const parent = await api.saveRace({ ...shared, parent_id: null, format: null, distance_km: 0 })
        for (const f of r.formats) {
          await api.saveRace({ ...shared, description: null, registration_url: null, parent_id: parent.id, format: f.format || null, distance_km: num(f.distance_km) })
        }
      }
    }, `${n} course${n > 1 ? 's' : ''} importée${n > 1 ? 's' : ''}`)
    setBusy(false)
    setProgress(0)
    if (ok) onClose()
  }

  return (
    <Sheet title="Importer un calendrier" onClose={onClose}>
      {!rows ? (
        <div className="form">
          <div className="segmented small">
            {SOURCES.map(([k, label]) => (
              <button type="button" key={k} className={source === k ? 'on' : ''} onClick={() => { setSource(k); setErr('') }}>{label}</button>
            ))}
          </div>

          {source === 'file' && (
            <>
              <p className="hint">
                Dans Google Agenda (sur ordinateur) : <strong>Paramètres</strong> → ton agenda → <strong>Exporter</strong>.
                Tu obtiens un .zip : décompresse-le et choisis le fichier .ics qu'il contient.
              </p>
              <input ref={fileInput} id="ics-file" type="file" accept=".ics,text/calendar" hidden onChange={onFile} onClick={(e) => { e.target.value = '' }} />
              <button type="button" className="btn btn-primary" onClick={() => fileInput.current.click()}>
                <Icon name="plus" size={18} /> Choisir un fichier .ics
              </button>
            </>
          )}

          {source === 'url' && (
            <>
              <p className="hint">
                Dans Google Agenda (sur ordinateur) : <strong>Paramètres</strong> → ton agenda → <strong>Intégrer l'agenda</strong> →
                copie l'<strong>adresse publique</strong> (ou <strong>secrète</strong>) <strong>au format iCal</strong>.
              </p>
              <Field label="Adresse du calendrier (.ics)">
                <input id="ics-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" />
              </Field>
              <button type="button" className="btn btn-primary" disabled={!url.trim() || busy} onClick={loadUrl}>
                {busy ? 'Lecture…' : 'Lire le calendrier'}
              </button>
            </>
          )}

          {source === 'text' && (
            <>
              <p className="hint">Colle ici le contenu d'un fichier .ics (il commence par BEGIN:VCALENDAR).</p>
              <Field label="Contenu du calendrier">
                <textarea id="ics-text" rows="6" value={text} onChange={(e) => setText(e.target.value)} placeholder="BEGIN:VCALENDAR…" />
              </Field>
              <button type="button" className="btn btn-primary" disabled={!text.trim()} onClick={() => read(text)}>Lire le calendrier</button>
            </>
          )}

          {err && <p className="form-error">{err}</p>}
        </div>
      ) : (
        <div className="form">
          <p className="hint">
            {rows.length} événement{rows.length > 1 ? 's' : ''} lu{rows.length > 1 ? 's' : ''} (doublons du calendrier regroupés).
            Sont décochés d'office : les entraînements et la vie du club, les dates « à confirmer », ce qui est déjà dans l'app.
            Vérifie discipline et distances, puis importe. Plusieurs distances = une épreuve à plusieurs formats.
          </p>
          {hiddenPast > 0 && (
            <label className="check">
              <input id="imp-past" type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
              Montrer aussi les {hiddenPast} événements passés
            </label>
          )}

          {visible.length === 0 && <Empty>Rien à importer.</Empty>}

          <ul className="bulk-list">
            {visible.map(([r, i]) => (
              <li key={r.uid || i} className={r.keep ? '' : 'is-absent'}>
                <label className="check">
                  <input id={`imp-${i}`} type="checkbox" checked={r.keep} disabled={r.exists} onChange={(e) => set(i, { keep: e.target.checked })} />
                  <span className="imp-head">
                    <strong>{r.name}</strong>
                    <small>
                      {fullDate(r.race_date)}{r.location ? ` · ${r.location}` : ''}
                      {!r.keep && <> · {r.formats.map((f) => f.format).join(', ') || 'distance inconnue'}</>}
                    </small>
                    <span className="imp-tags">
                      {r.exists && <em>Déjà dans l'app</em>}
                      {r.notRace && <em>{r.notRace}</em>}
                      {r.tentative && <em>À confirmer</em>}
                      {r.past && !r.exists && <em>Passée</em>}
                    </span>
                  </span>
                </label>

                {r.keep && (
                  <>
                    <div className="segmented small" role="group" aria-label="Discipline">
                      {Object.entries(DISCIPLINES).map(([k, v]) => (
                        <button type="button" key={k} className={r.discipline === k ? 'on' : ''} onClick={() => set(i, { discipline: k })}>{v.label}</button>
                      ))}
                    </div>
                    <label className="imp-name"><span>Nom</span>
                      <input id={`imp-name-${i}`} value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
                    </label>
                    <div className="imp-formats">
                      {r.formats.map((f, k) => (
                        <div key={k} className="imp-format">
                          <input id={`imp-fmt-${i}-${k}`} aria-label="Format" value={f.format} placeholder="10 km" onChange={(e) => setFormat(i, k, { format: e.target.value })} />
                          <input id={`imp-km-${i}-${k}`} aria-label="Distance en km" inputMode="decimal" value={f.distance_km} placeholder="km" onChange={(e) => setFormat(i, k, { distance_km: e.target.value })} />
                          <button type="button" className="icon-btn" aria-label="Retirer ce format" onClick={() => set(i, { formats: r.formats.filter((_, j) => j !== k) })}><Icon name="close" size={16} /></button>
                        </div>
                      ))}
                      <button type="button" className="link-btn" onClick={() => set(i, { formats: [...r.formats, { format: '', distance_km: '' }] })}>+ Ajouter une distance</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>

          {err && <p className="form-error">{err}</p>}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => { setRows(null); setErr('') }}>Changer de calendrier</button>
            <button type="button" className="btn btn-primary grow" disabled={!chosen.length || busy} onClick={submit}>
              {busy ? `Import… ${progress}/${chosen.length}` : chosen.length ? `Importer ${chosen.length} course${chosen.length > 1 ? 's' : ''}` : 'Rien de sélectionné'}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
