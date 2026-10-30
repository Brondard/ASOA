import { useMemo, useRef, useState } from 'react'
import { api } from '../api/index.js'
import { DISCIPLINES } from '../config.js'
import { fullDate, todayISO } from '../lib/format.js'
import { parseIcs, toRaces } from '../lib/ics.js'
import { useData } from '../store.jsx'
import { Empty, Field, Icon, Sheet } from '../ui.jsx'

const SOURCES = [['file', 'Fichier .ics'], ['url', 'Lien du calendrier'], ['text', 'Coller le texte']]
const sameRace = (a, b) =>
  a.race_date === b.race_date && a.name.trim().toLowerCase() === (b.name || '').trim().toLowerCase()

export default function ImportRaces({ onClose }) {
  const { races, run } = useData()
  const [source, setSource] = useState('file')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [rows, setRows] = useState(null) // null = pas encore lu
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileInput = useRef()

  const read = (ics) => {
    try {
      const found = toRaces(parseIcs(ics))
      if (!found.length) return setErr('Aucun événement trouvé dans ce calendrier.')
      setErr('')
      setRows(found.map((r) => ({
        ...r,
        exists: races.some((x) => sameRace(r, x)),
        keep: r.race_date >= todayISO() && !races.some((x) => sameRace(r, x)),
      })))
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
  const chosen = useMemo(() => (rows || []).filter((r) => r.keep), [rows])

  const submit = async () => {
    const bad = chosen.find((r) => !String(r.distance_km).trim() || isNaN(Number(String(r.distance_km).replace(',', '.'))))
    if (bad) return setErr(`Distance manquante pour « ${bad.name} ». Elle sert au challenge.`)
    setErr('')
    const ok = await run(async () => {
      for (const r of chosen) {
        const { uid, exists, keep, ...race } = r
        await api.saveRace({ ...race, distance_km: Number(String(r.distance_km).replace(',', '.')) })
      }
    }, `${chosen.length} course${chosen.length > 1 ? 's' : ''} importée${chosen.length > 1 ? 's' : ''}`)
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
                Dans Google Agenda : <strong>Paramètres</strong> → ton agenda → <strong>Exporter</strong>.
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
                copie l'<strong>adresse secrète au format iCal</strong>. Pas besoin de rendre l'agenda public.
              </p>
              <Field label="Adresse du calendrier (.ics)">
                <input id="ics-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/public/basic.ics" />
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
            {rows.length} événement{rows.length > 1 ? 's' : ''} lu{rows.length > 1 ? 's' : ''}.
            Décoche ce qui n'est pas une course, vérifie la discipline et la distance, puis importe.
            Les séances d'entraînement n'ont rien à faire ici : elles se créent depuis l'onglet Séances.
          </p>

          {rows.length === 0 && <Empty>Rien à importer.</Empty>}

          <ul className="bulk-list">
            {rows.map((r, i) => (
              <li key={r.uid || i} className={r.keep ? '' : 'is-absent'}>
                <label className="check">
                  <input id={`imp-${i}`} type="checkbox" checked={r.keep} disabled={r.exists} onChange={(e) => set(i, { keep: e.target.checked })} />
                  <span className="imp-head">
                    <strong>{r.name}</strong>
                    <small>
                      {fullDate(r.race_date)}
                      {r.location ? ` · ${r.location}` : ''}
                      {r.exists && ' · déjà dans l\'app'}
                      {!r.exists && r.race_date < todayISO() && ' · course passée'}
                    </small>
                  </span>
                </label>

                {r.keep && (
                  <>
                    <div className="segmented small" role="group" aria-label="Discipline">
                      {Object.entries(DISCIPLINES).map(([k, v]) => (
                        <button type="button" key={k} className={r.discipline === k ? 'on' : ''} onClick={() => set(i, { discipline: k })}>{v.label}</button>
                      ))}
                    </div>
                    <div className="bulk-fields">
                      <label><span>Nom</span>
                        <input id={`imp-name-${i}`} value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
                      </label>
                      <label><span>Format</span>
                        <input id={`imp-fmt-${i}`} value={r.format || ''} onChange={(e) => set(i, { format: e.target.value })} placeholder="10 km" />
                      </label>
                      <label><span>Distance</span>
                        <input id={`imp-km-${i}`} inputMode="decimal" value={r.distance_km} onChange={(e) => set(i, { distance_km: e.target.value })} placeholder="10" />
                      </label>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>

          {err && <p className="form-error">{err}</p>}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => { setRows(null); setErr('') }}>Changer de calendrier</button>
            <button type="button" className="btn btn-primary grow" disabled={!chosen.length} onClick={submit}>
              {chosen.length ? `Importer ${chosen.length} course${chosen.length > 1 ? 's' : ''}` : 'Rien de sélectionné'}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
