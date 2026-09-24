import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/index.js'
import { DISCIPLINES, USUAL_PLACES } from '../config.js'
import { addSessionToCalendar } from '../lib/calendar.js'
import { dayName, dayNum, fullName, hour, longDate, mapsUrl, monthShort, toLocalInput } from '../lib/format.js'
import { enablePush, pushState } from '../lib/push.js'
import { fmtVma, paceAt } from '../lib/vma.js'
import { go, useData } from '../store.jsx'
import { Avatar, ConfirmDelete, DiscChip, Empty, Field, Icon, PageHead, Sheet } from '../ui.jsx'

const FILTERS = [['all', 'Tout'], ...Object.entries(DISCIPLINES).map(([k, v]) => [k, v.short])]

export default function Sessions() {
  const { sessions, isAdmin } = useData()
  const [filter, setFilter] = useState('all')
  const [past, setPast] = useState(false)
  const [editing, setEditing] = useState(null) // null | {} | session
  const [cancelling, setCancelling] = useState(null)
  const [showWho, setShowWho] = useState(null)

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
    const { id, created_at, created_by, cancelled, cancel_reason, ...rest } = s
    setEditing({ ...rest, starts_at: d.toISOString() })
  }

  return (
    <>
      <PageHead
        kicker={past ? 'Historique' : 'Entraînements'}
        title={past ? 'Séances passées' : 'Prochaines séances'}
        action={isAdmin && <button className="btn btn-primary" onClick={() => setEditing({})}><Icon name="plus" size={18} /> Séance</button>}
      />
      {!past && <PushNudge />}
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
                <SessionCard key={s.id} s={s} past={past} isAdmin={isAdmin}
                  onEdit={() => setEditing(s)} onDuplicate={() => duplicate(s)}
                  onCancel={() => setCancelling(s)} onWho={() => setShowWho(s)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <button className="link-btn" onClick={() => setPast(!past)}>
        {past ? '← Revenir aux prochaines séances' : 'Voir les séances passées'}
      </button>

      {editing && <SessionForm initial={editing} onClose={() => setEditing(null)} />}
      {cancelling && <CancelForm s={cancelling} onClose={() => setCancelling(null)} />}
      {showWho && <WhoComes s={showWho} onClose={() => setShowWho(null)} />}
    </>
  )
}

// Invitation à activer les notifications (masquable)
function PushNudge() {
  const { setToast } = useData()
  const [state, setState] = useState(null)
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem('asoa-push-nudge') === 'hide' } catch { return false }
  })
  useEffect(() => { pushState().then(setState).catch(() => {}) }, [])
  if (hidden || !['off', 'needs-install', 'demo'].includes(state)) return null
  const hide = () => {
    setHidden(true)
    try { localStorage.setItem('asoa-push-nudge', 'hide') } catch { /* navigation privée */ }
  }
  const activate = async () => {
    if (state !== 'off') return go('profil')
    try {
      await enablePush()
      setToast({ text: 'Notifications activées' })
      hide()
    } catch (e) {
      setToast({ text: e.message, error: true })
    }
  }
  return (
    <section className="push-box push-nudge">
      <span className="push-icon"><Icon name="bell" size={22} /></span>
      <div>
        <strong>Ne rate plus une séance</strong>
        <p>{state === 'needs-install' ? 'Ajoute l\'app à ton écran d\'accueil pour recevoir les notifications.' : 'Rappel la veille, séance annulée, résultats en ligne.'}</p>
      </div>
      <button className="btn btn-primary" onClick={activate}>{state === 'off' ? 'Activer' : 'Comment faire'}</button>
      <button className="icon-btn" onClick={hide} aria-label="Masquer"><Icon name="close" size={18} /></button>
    </section>
  )
}

const RSVP = [['yes', 'Je viens'], ['maybe', 'Peut-être'], ['no', 'Pas dispo']]

function SessionCard({ s, past, isAdmin, onEdit, onDuplicate, onCancel, onWho }) {
  const { attendance, profiles, me, setAttendance, run } = useData()
  const answers = attendance.filter((a) => a.session_id === s.id)
  const mine = answers.find((a) => a.member_id === me.id)?.status
  const yes = answers.filter((a) => a.status === 'yes')
  const maybe = answers.filter((a) => a.status === 'maybe')
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]))
  const short = s.min_participants && yes.length < s.min_participants

  return (
    <article className={`session ${s.cancelled ? 'is-cancelled' : ''}`}>
      {s.cancelled && <p className="cancel-banner"><strong>Séance annulée</strong>{s.cancel_reason && <> · {s.cancel_reason}</>}</p>}
      <div className="session-top">
        <span className="session-time"><Icon name="clock" size={16} /> {hour(s.starts_at)}{s.duration_min ? ` · ${s.duration_min} min` : ''}</span>
        {!past && !s.cancelled && (
          <button className="cal-btn" onClick={() => addSessionToCalendar(s)} aria-label="Ajouter à mon agenda"><Icon name="calendar" size={15} /> Agenda</button>
        )}
        <DiscChip d={s.discipline} />
      </div>
      <h3>{s.title}</h3>
      <a className="place" href={mapsUrl(s)} target="_blank" rel="noreferrer">
        <Icon name="pin" size={16} />
        <span><strong>{s.location_name}</strong>{s.address && <small>{s.address}</small>}</span>
        <span className="place-go"><Icon name="route" size={16} /> Itinéraire</span>
      </a>
      {s.description && <p className="session-desc">{s.description}</p>}

      <button className="who-row" onClick={onWho}>
        <span className="stack">{yes.slice(0, 5).map((a) => <Avatar key={a.member_id} p={byId[a.member_id]} size={26} />)}</span>
        <span className="who-count">
          <strong>{yes.length}</strong> {past ? (yes.length > 1 ? 'inscrits' : 'inscrit') : (yes.length > 1 ? 'viennent' : 'vient')}
          {maybe.length > 0 && <small> · {maybe.length} peut-être</small>}
        </span>
        {s.min_participants && !s.cancelled && (
          <span className={`min-chip ${short ? 'short' : 'ok'}`}>{short ? `${yes.length}/${s.min_participants} min.` : 'Minimum atteint'}</span>
        )}
      </button>

      {!past && !s.cancelled && (
        <div className="rsvp" role="group" aria-label="Ta présence">
          {RSVP.map(([k, label]) => (
            <button key={k} className={`rsvp-${k} ${mine === k ? 'on' : ''}`} aria-pressed={mine === k}
              onClick={() => setAttendance(s.id, mine === k ? null : k)}>{label}</button>
          ))}
        </div>
      )}

      {isAdmin && (
        <div className="admin-row">
          <button className="btn btn-ghost" onClick={onEdit}><Icon name="edit" size={16} /> Modifier</button>
          <button className="btn btn-ghost" onClick={onDuplicate}><Icon name="copy" size={16} /> Dupliquer +7 j</button>
          {!past && (s.cancelled
            ? <button className="btn btn-ghost" onClick={() => run(() => api.updateSession(s.id, { cancelled: false, cancel_reason: null }), 'Séance rétablie')}>Rétablir</button>
            : <button className="btn btn-ghost danger-text" onClick={onCancel}>Annuler la séance</button>)}
        </div>
      )}
    </article>
  )
}

function WhoComes({ s, onClose }) {
  const { attendance, profiles, isAdmin } = useData()
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]))
  const groups = RSVP.map(([k, label]) => [label, attendance.filter((a) => a.session_id === s.id && a.status === k).map((a) => byId[a.member_id]).filter(Boolean)])
  return (
    <Sheet title={`${s.title} · ${longDate(s.starts_at)}`} onClose={onClose}>
      {groups.every(([, l]) => !l.length) && <Empty>Personne n'a encore répondu.</Empty>}
      {groups.map(([label, list]) => list.length > 0 && (
        <section key={label} className="who-group">
          <h3>{label} <small>{list.length}</small></h3>
          <ul>{list.map((p) => (
            <li key={p.id}>
              <Avatar p={p} size={32} />
              <span className="who-name">{fullName(p)}</span>
              {p.vma
                ? <span className="vma-tag">{fmtVma(p.vma)}<small>{paceAt(p.vma)}/km</small></span>
                : isAdmin && <span className="vma-tag empty">VMA ?</span>}
            </li>
          ))}</ul>
        </section>
      ))}
    </Sheet>
  )
}

function CancelForm({ s, onClose }) {
  const { run, notify } = useData()
  const [reason, setReason] = useState('')
  const [warn, setWarn] = useState(true)
  const submit = async (e) => {
    e.preventDefault()
    if (await run(() => api.updateSession(s.id, { cancelled: true, cancel_reason: reason || null }), 'Séance annulée')) {
      if (warn) notify('session_cancelled', s.id)
      onClose()
    }
  }
  return (
    <Sheet title="Annuler la séance" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="muted-p">{s.title} · {longDate(s.starts_at)} à {hour(s.starts_at)}</p>
        <Field label="Raison (visible par tous)"><input id="c-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Pas assez d'inscrits, météo…" /></Field>
        <label className="check"><input id="c-warn" type="checkbox" checked={warn} onChange={(e) => setWarn(e.target.checked)} /> Prévenir les inscrits par notification</label>
        <div className="form-actions"><button className="btn btn-primary grow" type="submit">Confirmer l'annulation</button></div>
      </form>
    </Sheet>
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
  const { notify } = useData()
  const [warn, setWarn] = useState(!initial.id)

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
      min_participants: f.min_participants ? Number(f.min_participants) : null,
      created_by: f.created_by || me.id,
    }
    const saved = await run(() => api.saveSession(row), f.id ? 'Séance modifiée' : 'Séance publiée')
    if (saved) {
      if (warn) notify(f.id ? 'session_updated' : 'session_new', saved.id || f.id)
      onClose()
    }
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
        <Field label="Minimum de participants" hint="Optionnel. La veille, tu es prévenu s'il manque du monde.">
          <input id="s-min" type="number" min="1" value={f.min_participants ?? ''} onChange={set('min_participants')} placeholder="Ex. 4" />
        </Field>
        <Field label="Lieu de rendez-vous" hint="Choisis un lieu habituel ou tape-en un nouveau.">
          <input id="s-place" required list="places" value={f.location_name} onChange={onPlace} placeholder="Stade du Fort Carré" />
          <datalist id="places">{places.map((p) => <option key={p.name} value={p.name} />)}</datalist>
        </Field>
        <Field label="Adresse"><input id="s-addr" value={f.address || ''} onChange={set('address')} placeholder="Avenue du 11 Novembre, Antibes" /></Field>
        <Field label="Contenu de la séance">
          <textarea id="s-desc" rows="4" value={f.description || ''} onChange={set('description')} placeholder="Échauffement 20 min, 10 × 400 m récup 1 min…" />
        </Field>
        <label className="check"><input id="s-warn" type="checkbox" checked={warn} onChange={(e) => setWarn(e.target.checked)} />
          {f.id ? 'Prévenir les inscrits de la modification' : 'Prévenir les adhérents par notification'}</label>
        <div className="form-actions">
          {f.id && <ConfirmDelete onConfirm={async () => (await run(() => api.deleteSession(f.id), 'Séance supprimée')) && onClose()} />}
          <button className="btn btn-primary grow" type="submit">{f.id ? 'Enregistrer' : 'Publier la séance'}</button>
        </div>
      </form>
    </Sheet>
  )
}
