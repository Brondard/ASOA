import { useMemo, useState } from 'react'
import { api } from '../api/index.js'
import { DISCIPLINES, USUAL_PLACES } from '../config.js'
import { dayName, dayNum, hour, longDate, mapsUrl, monthShort, toLocalInput } from '../lib/format.js'
import { useData } from '../store.jsx'
import { ConfirmDelete, DiscChip, Empty, Field, Icon, PageHead, Sheet } from '../ui.jsx'

const FILTERS = [['all', 'Tout'], ...Object.entries(DISCIPLINES).map(([k, v]) => [k, v.short])]

export default function Sessions() {
  const { sessions, isAdmin } = useData()
  const [filter, setFilter] = useState('all')
  const [past, setPast] = useState(false)
  const [editing, setEditing] = useState(null) // null | {} | session

  const days = useMemo(() => {
    const now = Date.now() - 2 * 3600e3
    const list = sessions
      .filter((s) => (past ? new Date(s.starts_at) < now : new Date(s.starts_at) >= now))
      .filter((s) => filter === 'all' || s.discipline === filter)
    if (past) list.reverse()
    const groups = []
    for (const s of list) {
      const key = longDate(s.starts_at)
      const g = groups.at(-1)
      if (g?.key === key) g.items.push(s)
      else groups.push({ key, date: s.starts_at, items: [s] })
    }
    return groups
  }, [sessions, filter, past])

  const duplicate = (s) => {
    const d = new Date(s.starts_at)
    d.setDate(d.getDate() + 7)
    const { id, created_at, created_by, ...rest } = s
    setEditing({ ...rest, starts_at: d.toISOString() })
  }

  return (
    <>
      <PageHead
        kicker={past ? 'Historique' : 'Entraînements'}
        title={past ? 'Séances passées' : 'Prochaines séances'}
        action={isAdmin && <button className="btn btn-primary" onClick={() => setEditing({})}><Icon name="plus" size={18} /> Séance</button>}
      />
      <div className="segmented" role="tablist">
        {FILTERS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>

      {days.length === 0 && <Empty>{past ? 'Aucune séance passée.' : 'Aucune séance programmée pour l\'instant.'}</Empty>}

      <div className="days">
        {days.map((g) => (
          <section key={g.key} className="day">
            <div className="bib" aria-label={g.key}>
              <span className="bib-dow">{dayName(g.date)}</span>
              <span className="bib-num">{dayNum(g.date)}</span>
              <span className="bib-month">{monthShort(g.date)}</span>
            </div>
            <div className="day-items">
              {g.items.map((s) => (
                <article key={s.id} className="session">
                  <div className="session-top">
                    <span className="session-time"><Icon name="clock" size={16} /> {hour(s.starts_at)}{s.duration_min ? ` · ${s.duration_min} min` : ''}</span>
                    <DiscChip d={s.discipline} />
                  </div>
                  <h3>{s.title}</h3>
                  <a className="place" href={mapsUrl(s)} target="_blank" rel="noreferrer">
                    <Icon name="pin" size={16} />
                    <span><strong>{s.location_name}</strong>{s.address && <small>{s.address}</small>}</span>
                    <span className="place-go"><Icon name="route" size={16} /> Itinéraire</span>
                  </a>
                  {s.description && <p className="session-desc">{s.description}</p>}
                  {isAdmin && (
                    <div className="admin-row">
                      <button className="btn btn-ghost" onClick={() => setEditing(s)}><Icon name="edit" size={16} /> Modifier</button>
                      <button className="btn btn-ghost" onClick={() => duplicate(s)}><Icon name="copy" size={16} /> Dupliquer +7 j</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <button className="link-btn" onClick={() => setPast(!past)}>
        {past ? '← Revenir aux prochaines séances' : 'Voir les séances passées'}
      </button>

      {editing && <SessionForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function SessionForm({ initial, onClose }) {
  const { run, sessions, me } = useData()
  const defaultStart = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(18, 30, 0, 0)
    return d.toISOString()
  }
  const [f, setF] = useState({
    title: '', discipline: 'running', duration_min: 60, location_name: '', address: '', description: '',
    ...initial,
    starts_at: toLocalInput(initial.starts_at || defaultStart()),
  })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  // Lieux connus = lieux habituels + lieux déjà utilisés
  const places = useMemo(() => {
    const m = new Map(USUAL_PLACES.map((p) => [p.name, p]))
    sessions.forEach((s) => !m.has(s.location_name) && m.set(s.location_name, { name: s.location_name, address: s.address, lat: s.lat, lng: s.lng }))
    return [...m.values()]
  }, [sessions])

  const onPlace = (e) => {
    const name = e.target.value
    const known = places.find((p) => p.name === name)
    setF({ ...f, location_name: name, ...(known ? { address: known.address || '', lat: known.lat ?? null, lng: known.lng ?? null } : { lat: null, lng: null }) })
  }

  const submit = async (e) => {
    e.preventDefault()
    const row = {
      ...f,
      starts_at: new Date(f.starts_at).toISOString(),
      duration_min: f.duration_min ? Number(f.duration_min) : null,
      created_by: f.created_by || me.id,
    }
    if (await run(() => api.saveSession(row), f.id ? 'Séance modifiée' : 'Séance publiée')) onClose()
  }

  return (
    <Sheet title={f.id ? 'Modifier la séance' : 'Nouvelle séance'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Discipline">
          <div className="segmented small">
            {Object.entries(DISCIPLINES).map(([k, v]) => (
              <button type="button" key={k} className={f.discipline === k ? 'on' : ''} onClick={() => setF({ ...f, discipline: k })}>{v.label}</button>
            ))}
          </div>
        </Field>
        <Field label="Titre"><input id="s-title" required value={f.title} onChange={set('title')} placeholder="Fractionné piste" /></Field>
        <div className="row2">
          <Field label="Date et heure"><input id="s-start" type="datetime-local" required value={f.starts_at} onChange={set('starts_at')} /></Field>
          <Field label="Durée (min)"><input id="s-dur" type="number" min="0" step="5" value={f.duration_min ?? ''} onChange={set('duration_min')} /></Field>
        </div>
        <Field label="Lieu de rendez-vous" hint="Choisis un lieu habituel ou tape-en un nouveau.">
          <input id="s-place" required list="places" value={f.location_name} onChange={onPlace} placeholder="Stade du Fort Carré" />
          <datalist id="places">{places.map((p) => <option key={p.name} value={p.name} />)}</datalist>
        </Field>
        <Field label="Adresse"><input id="s-addr" value={f.address || ''} onChange={set('address')} placeholder="Avenue du 11 Novembre, Antibes" /></Field>
        <Field label="Contenu de la séance">
          <textarea id="s-desc" rows="4" value={f.description || ''} onChange={set('description')} placeholder="Échauffement 20 min, 10 × 400 m récup 1 min…" />
        </Field>
        <div className="form-actions">
          {f.id && <ConfirmDelete onConfirm={async () => (await run(() => api.deleteSession(f.id), 'Séance supprimée')) && onClose()} />}
          <button className="btn btn-primary grow" type="submit">{f.id ? 'Enregistrer' : 'Publier la séance'}</button>
        </div>
      </form>
    </Sheet>
  )
}
