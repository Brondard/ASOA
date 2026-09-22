import { useMemo, useState } from 'react'
import { api } from '../api/index.js'
import { DISCIPLINES } from '../config.js'
import { fmtTime, fullDate, fullName, km, pace, parseTime, seasonOf } from '../lib/format.js'
import { recordBreakers } from '../lib/records.js'
import { go, useData } from '../store.jsx'
import { Avatar, ConfirmDelete, DiscChip, Empty, Field, Icon, PageHead, Sheet } from '../ui.jsx'

export const Medal = ({ n }) => (n ? <span className={`medal medal-${n}`} title={`Podium catégorie : ${n}e`}>{n}</span> : null)

const todayISO = () => new Date().toLocaleDateString('sv-SE') // AAAA-MM-JJ en heure locale
export const isUpcoming = (r) => r.race_date >= todayISO()
export const daysTo = (d) => Math.round((new Date(d + 'T12:00:00') - new Date(todayISO() + 'T12:00:00')) / 864e5)

export default function Races() {
  const { races, results, me, isAdmin, registrations } = useData()
  const [mine, setMine] = useState(false)
  const [editing, setEditing] = useState(null)

  const bySeason = useMemo(() => {
    const count = {}
    const myRes = {}
    results.forEach((r) => {
      count[r.race_id] = (count[r.race_id] || 0) + 1
      if (r.member_id === me.id) myRes[r.race_id] = r
    })
    const out = []
    for (const r of races) {
      if (isUpcoming(r) && !results.some((x) => x.race_id === r.id)) continue
      if (mine && !myRes[r.id]) continue
      const s = seasonOf(r.race_date)
      const item = { ...r, n: count[r.id] || 0, my: myRes[r.id] }
      const g = out.at(-1)
      if (g?.season === s) g.items.push(item)
      else out.push({ season: s, items: [item] })
    }
    return out
  }, [races, results, me.id, mine])

  const upcoming = useMemo(() => races
    .filter((r) => isUpcoming(r) && !results.some((x) => x.race_id === r.id))
    .filter((r) => !mine || registrations.some((g) => g.race_id === r.id && g.member_id === me.id))
    .sort((a, b) => (b.is_club_goal - a.is_club_goal) || a.race_date.localeCompare(b.race_date)), [races, results, registrations, mine, me.id])

  return (
    <>
      <PageHead
        kicker="Compétitions"
        title="Résultats"
        action={isAdmin && <button className="btn btn-primary" onClick={() => setEditing({})}><Icon name="plus" size={18} /> Course</button>}
      />
      <div className="segmented">
        <button className={!mine ? 'on' : ''} onClick={() => setMine(false)}>Tout le club</button>
        <button className={mine ? 'on' : ''} onClick={() => setMine(true)}>Mes courses</button>
      </div>

      {upcoming.length > 0 && (
        <section className="season">
          <h2 className="season-title">À venir</h2>
          <div className="upcoming">{upcoming.map((r) => <UpcomingCard key={r.id} r={r} />)}</div>
        </section>
      )}

      {bySeason.length === 0 && upcoming.length === 0 && <Empty>{mine ? 'Tu n\'as pas encore de résultat enregistré.' : 'Aucune course pour l\'instant.'}</Empty>}

      {bySeason.map((g) => (
        <section key={g.season} className="season">
          <h2 className="season-title">Saison {g.season}</h2>
          <ul className="race-list">
            {g.items.map((r) => (
              <li key={r.id}>
                <button className="race-row" onClick={() => go(`resultats/${r.id}`)}>
                  <span className="race-date">{fullDate(r.race_date)}</span>
                  <span className="race-name">{r.name}</span>
                  <span className="race-meta">
                    <DiscChip d={r.discipline} /> {r.format || `${km(r.distance_km)} km`}
                    {!mine && <> · {r.n} adhérent{r.n > 1 ? 's' : ''}</>}
                  </span>
                  {r.my && (
                    <span className="race-my">
                      <strong>{fmtTime(r.my.time_seconds)}</strong>
                      {r.my.rank_overall && <small>{r.my.rank_overall}e</small>}
                      <Medal n={r.my.podium} />
                    </span>
                  )}
                  <span className="race-chev"><Icon name="chevron" size={18} /></span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editing && <RaceForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

export const REG = [['going', "J'y vais"], ['interested', 'Intéressé']]

export function RegisterButtons({ race }) {
  const { registrations, me, setRegistration } = useData()
  const mine = registrations.find((g) => g.race_id === race.id && g.member_id === me.id)?.status
  return (
    <div className="rsvp two" role="group" aria-label="Ta participation">
      {REG.map(([k, label]) => (
        <button key={k} className={`rsvp-${k === 'going' ? 'yes' : 'maybe'} ${mine === k ? 'on' : ''}`} aria-pressed={mine === k}
          onClick={(e) => { e.stopPropagation(); setRegistration(race.id, mine === k ? null : k) }}>{label}</button>
      ))}
    </div>
  )
}

function UpcomingCard({ r }) {
  const { registrations, profiles } = useData()
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]))
  const going = registrations.filter((g) => g.race_id === r.id && g.status === 'going')
  const interested = registrations.filter((g) => g.race_id === r.id && g.status === 'interested')
  const d = daysTo(r.race_date)
  return (
    <article className={`up-card ${r.is_club_goal ? 'goal' : ''}`} onClick={() => go(`resultats/${r.id}`)}>
      {r.is_club_goal && <span className="goal-tag">Objectif club</span>}
      <div className="up-head">
        <div className="countdown"><span>J-</span>{d}</div>
        <div className="up-id">
          <span className="race-date">{fullDate(r.race_date)}{r.location ? ` · ${r.location}` : ''}</span>
          <h3>{r.name}</h3>
          <span className="race-meta"><DiscChip d={r.discipline} /> {r.format || `${km(r.distance_km)} km`}</span>
        </div>
      </div>
      <div className="who-row static">
        <span className="stack">{going.slice(0, 6).map((g) => <Avatar key={g.member_id} p={byId[g.member_id]} size={26} />)}</span>
        <span className="who-count"><strong>{going.length}</strong> ASOA au départ{interested.length > 0 && <small> · {interested.length} intéressé{interested.length > 1 ? 's' : ''}</small>}</span>
      </div>
      <RegisterButtons race={r} />
    </article>
  )
}

export function RaceDetail({ id }) {
  const { races, results, profiles, isAdmin, me, registrations, notify } = useData()
  const [editRace, setEditRace] = useState(false)
  const [editRes, setEditRes] = useState(null)
  const [bulk, setBulk] = useState(false)
  const race = races.find((r) => r.id === id)
  const rows = useMemo(() => {
    const byId = Object.fromEntries(profiles.map((p) => [p.id, p]))
    return results
      .filter((r) => r.race_id === id)
      .map((r) => ({ ...r, p: byId[r.member_id] }))
      .sort((a, b) => (a.time_seconds ?? Infinity) - (b.time_seconds ?? Infinity))
  }, [results, profiles, id])

  const prs = useMemo(() => recordBreakers(results, races), [results, races])
  // Inscrits (J'y vais / Intéressé) qui n'ont pas encore de résultat
  const pending = useMemo(() => {
    const done = new Set(results.filter((r) => r.race_id === id).map((r) => r.member_id))
    return registrations
      .filter((g) => g.race_id === id && !done.has(g.member_id))
      .sort((a, b) => (a.status === 'going' ? 0 : 1) - (b.status === 'going' ? 0 : 1))
  }, [registrations, results, id])
  if (!race) return <><PageHead back title="Course introuvable" /><Empty>Cette course a peut-être été supprimée.</Empty></>

  return (
    <>
      <PageHead back kicker={fullDate(race.race_date)} title={race.name}
        action={isAdmin && <button className="icon-btn" onClick={() => setEditRace(true)} aria-label="Modifier la course"><Icon name="edit" /></button>} />
      <dl className="facts">
        <div><dt>Discipline</dt><dd><DiscChip d={race.discipline} /></dd></div>
        <div><dt>Format</dt><dd>{race.format || '—'}</dd></div>
        <div><dt>Distance</dt><dd className="num">{km(race.distance_km)} km</dd></div>
        <div><dt>Lieu</dt><dd>{race.location || '—'}</dd></div>
      </dl>

      {isUpcoming(race) && rows.length === 0 && <RaceSignup race={race} />}
      {(race.description || race.registration_url) && (
        <section className="info-block">
          {race.is_club_goal && <span className="goal-tag">Objectif club</span>}
          {race.description && <p>{race.description}</p>}
          {race.registration_url && <a className="btn btn-dark" href={race.registration_url} target="_blank" rel="noreferrer">S'inscrire sur le site de la course</a>}
        </section>
      )}

      {isAdmin && race.race_date <= todayISO() && pending.some((g) => g.status === 'going') && (
        <section className="bulk-callout">
          <div>
            <strong>{pending.filter((g) => g.status === 'going').length} inscrit{pending.filter((g) => g.status === 'going').length > 1 ? 's' : ''} sans résultat</strong>
            <p>Saisis tous leurs temps d'un coup{pending.some((g) => g.status === 'interested') ? ' (les « Intéressés » sont aussi dans la liste)' : ''}.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setBulk(true)}>Saisir les temps des inscrits</button>
        </section>
      )}

      {(!isUpcoming(race) || rows.length > 0 || isAdmin) && <div className="table-head">
        <h2>{rows.length ? `${rows.length} résultat${rows.length > 1 ? 's' : ''}` : 'Résultats'}</h2>
        {isAdmin && <button className="btn btn-primary" onClick={() => setEditRes({ race_id: id })}><Icon name="plus" size={18} /> Résultat</button>}
      </div>}

      {rows.length === 0 ? (!isUpcoming(race) && <Empty>Aucun résultat saisi pour cette course.</Empty>) : (
        <div className="table-wrap">
          <table className="results">
            <thead>
              <tr><th className="c-pos">#</th><th>Adhérent</th><th className="c-num">Temps</th><th className="c-num">Scratch</th>{race.discipline !== 'triathlon' && <th className="c-num hide-sm">Allure</th>}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={r.member_id === me.id ? 'me' : ''} onClick={() => (isAdmin ? setEditRes(r) : go(`membres/${r.member_id}`))}>
                  <td className="c-pos">{r.time_seconds ? i + 1 : '–'}</td>
                  <td>
                    <span className="who"><Avatar p={r.p} size={30} /><span>{fullName(r.p)}</span><Medal n={r.podium} /></span>
                  </td>
                  <td className="c-num strong">{prs.has(r.id) && <span className="pr-tag" title="Record perso battu">RP</span>}{fmtTime(r.time_seconds)}</td>
                  <td className="c-num">{r.rank_overall ? <>{r.rank_overall}{r.finishers && <small>/{r.finishers}</small>}</> : '–'}</td>
                  {race.discipline !== 'triathlon' && <td className="c-num hide-sm">{pace(r.time_seconds, race.distance_km) || '–'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {isAdmin && rows.length > 0 && (
        <div className="admin-foot">
          <p className="hint">Touche une ligne pour la modifier. Quand tout est saisi :</p>
          <button className="btn btn-ghost" onClick={() => notify('results', race.id)}><Icon name="bell" size={16} /> Prévenir le club : résultats en ligne</button>
        </div>
      )}

      {editRace && <RaceForm initial={race} onClose={() => setEditRace(false)} onDeleted={() => go('resultats')} />}
      {editRes && <ResultForm initial={editRes} race={race} onClose={() => setEditRes(null)} />}
      {bulk && <BulkResults race={race} pending={pending} onClose={() => setBulk(false)} />}
    </>
  )
}

// Saisie groupée : une ligne par inscrit, on remplit et on enregistre tout d'un coup
const BULK_STATUS = [['ok', 'Classé'], ['dnf', 'Abandon'], ['absent', 'Pas couru']]

function BulkResults({ race, pending, onClose }) {
  const { profiles, results, run, notify } = useData()
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]))
  const knownFinishers = results.find((r) => r.race_id === race.id && r.finishers)?.finishers
  const [finishers, setFinishers] = useState(knownFinishers || '')
  const [rows, setRows] = useState(() => pending.map((g) => ({
    member_id: g.member_id, reg: g.status, status: g.status === 'going' ? 'ok' : 'absent', time: '', rank: '', podium: '',
  })))
  const [errors, setErrors] = useState({})
  const [warn, setWarn] = useState(true)
  const set = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    const toSave = []
    const noShow = [] // inscrits « J'y vais » qui n'ont finalement pas couru
    rows.forEach((r, i) => {
      if (r.status === 'absent') {
        if (r.reg === 'going') noShow.push(r.member_id)
        return
      }
      const secs = r.status === 'dnf' ? null : parseTime(r.time)
      if (r.status === 'ok' && !secs) errs[i] = r.time ? 'Format : 1:23:45 ou 45:30' : 'Temps manquant'
      toSave.push({
        race_id: race.id, member_id: r.member_id, time_seconds: secs,
        rank_overall: r.status === 'ok' && r.rank ? Number(r.rank) : null,
        finishers: finishers ? Number(finishers) : null,
        podium: r.status === 'ok' && r.podium ? Number(r.podium) : null,
        note: null,
      })
    })
    setErrors(errs)
    if (Object.keys(errs).length) return
    if (!toSave.length && !noShow.length) return onClose()
    const ok = await run(async () => {
      for (const row of toSave) await api.saveResult(row)
      for (const m of noShow) await api.setRegistration(race.id, m, null)
    }, toSave.length ? `${toSave.length} résultat${toSave.length > 1 ? 's' : ''} enregistré${toSave.length > 1 ? 's' : ''}` : 'Inscriptions mises à jour')
    if (ok) {
      if (warn && toSave.length) notify('results', race.id)
      onClose()
    }
  }

  const nb = rows.filter((r) => r.status !== 'absent').length
  return (
    <Sheet title={`Temps des inscrits · ${race.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Nombre de classés (optionnel)" hint="Commun à tous : sert à afficher « 123/1450 ».">
          <input id="b-fin" type="number" min="1" value={finishers} onChange={(e) => setFinishers(e.target.value)} />
        </Field>
        <ul className="bulk-list">
          {rows.map((r, i) => {
            const p = byId[r.member_id]
            return (
              <li key={r.member_id} className={r.status === 'absent' ? 'is-absent' : ''}>
                <div className="bulk-who">
                  <Avatar p={p} size={32} />
                  <span><strong>{fullName(p)}</strong><small>{r.reg === 'going' ? "Inscrit « J'y vais »" : 'Intéressé'}</small></span>
                </div>
                <div className="segmented small" role="group" aria-label={`Statut de ${fullName(p)}`}>
                  {BULK_STATUS.map(([k, l]) => (
                    <button type="button" key={k} className={r.status === k ? 'on' : ''} onClick={() => set(i, { status: k })}>{l}</button>
                  ))}
                </div>
                {r.status === 'ok' && (
                  <div className="bulk-fields">
                    <label><span>Temps</span>
                      <input id={`b-time-${i}`} inputMode="numeric" placeholder="1:42:18" value={r.time} onChange={(e) => set(i, { time: e.target.value })} aria-invalid={!!errors[i]} />
                    </label>
                    <label><span>Scratch</span>
                      <input id={`b-rank-${i}`} type="number" min="1" value={r.rank} onChange={(e) => set(i, { rank: e.target.value })} />
                    </label>
                    <label><span>Podium</span>
                      <select id={`b-pod-${i}`} value={r.podium} onChange={(e) => set(i, { podium: e.target.value })}>
                        <option value="">—</option><option value="1">1er</option><option value="2">2e</option><option value="3">3e</option>
                      </select>
                    </label>
                  </div>
                )}
                {errors[i] && <p className="form-error">{errors[i]}</p>}
              </li>
            )
          })}
        </ul>
        <p className="hint">« Pas couru » retire l'inscription. Quelqu'un a couru sans s'inscrire ? Ajoute-le ensuite avec le bouton « + Résultat ».</p>
        <label className="check"><input id="b-warn" type="checkbox" checked={warn} onChange={(e) => setWarn(e.target.checked)} /> Prévenir le club : résultats en ligne</label>
        <div className="form-actions">
          <button className="btn btn-primary grow" type="submit">{nb ? `Enregistrer ${nb} résultat${nb > 1 ? 's' : ''}` : 'Enregistrer'}</button>
        </div>
      </form>
    </Sheet>
  )
}

function RaceSignup({ race }) {
  const { registrations, profiles } = useData()
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]))
  const list = (k) => registrations.filter((g) => g.race_id === race.id && g.status === k).map((g) => byId[g.member_id]).filter(Boolean)
  const going = list('going'), interested = list('interested')
  return (
    <section className="signup">
      <div className="signup-top">
        <div className="countdown big"><span>J-</span>{daysTo(race.race_date)}</div>
        <p><strong>{going.length}</strong> adhérent{going.length > 1 ? 's' : ''} au départ{interested.length > 0 && <> · {interested.length} intéressé{interested.length > 1 ? 's' : ''}</>}</p>
      </div>
      <RegisterButtons race={race} />
      {[['Au départ', going], ['Intéressés', interested]].map(([label, l]) => l.length > 0 && (
        <div key={label} className="who-group">
          <h3>{label} <small>{l.length}</small></h3>
          <ul>{l.map((p) => <li key={p.id} onClick={() => go(`membres/${p.id}`)}><Avatar p={p} size={32} /> {fullName(p)}</li>)}</ul>
        </div>
      ))}
    </section>
  )
}

function RaceForm({ initial, onClose, onDeleted }) {
  const { run, notify } = useData()
  const [f, setF] = useState({ name: '', race_date: new Date().toISOString().slice(0, 10), location: '', discipline: 'running', format: '', distance_km: '', description: '', registration_url: '', is_club_goal: false, ...initial })
  const [warn, setWarn] = useState(!initial.id)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault()
    const row = { ...f, distance_km: Number(String(f.distance_km).replace(',', '.')), description: f.description || null, registration_url: f.registration_url || null }
    const saved = await run(() => api.saveRace(row), f.id ? 'Course modifiée' : 'Course créée')
    if (saved) {
      if (warn && isUpcoming(row)) notify('race_new', saved.id || f.id)
      onClose()
      if (!f.id && saved.id) go(`resultats/${saved.id}`)
    }
  }
  return (
    <Sheet title={f.id ? 'Modifier la course' : 'Nouvelle course'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Nom de la course"><input id="r-name" required value={f.name} onChange={set('name')} placeholder="Semi-marathon de Nice" /></Field>
        <div className="row2">
          <Field label="Date"><input id="r-date" type="date" required value={f.race_date} onChange={set('race_date')} /></Field>
          <Field label="Lieu"><input id="r-loc" value={f.location || ''} onChange={set('location')} placeholder="Nice" /></Field>
        </div>
        <Field label="Discipline">
          <div className="segmented small">
            {Object.entries(DISCIPLINES).map(([k, v]) => (
              <button type="button" key={k} className={f.discipline === k ? 'on' : ''} onClick={() => setF({ ...f, discipline: k })}>{v.label}</button>
            ))}
          </div>
        </Field>
        <div className="row2">
          <Field label="Format"><input id="r-format" value={f.format || ''} onChange={set('format')} placeholder="Distance M, 25 km · 1200 D+…" /></Field>
          <Field label="Distance (km)" hint="Compte pour le challenge. Triathlon : total nage + vélo + course.">
            <input id="r-km" required inputMode="decimal" value={f.distance_km} onChange={set('distance_km')} placeholder="21,1" />
          </Field>
        </div>
        <Field label="Infos pour les adhérents" hint="Déplacement, hébergement, plan d'entraînement…">
          <textarea id="r-desc" rows="3" value={f.description || ''} onChange={set('description')} />
        </Field>
        <Field label="Lien d'inscription (optionnel)"><input id="r-url" type="url" value={f.registration_url || ''} onChange={set('registration_url')} placeholder="https://…" /></Field>
        <label className="check"><input id="r-goal" type="checkbox" checked={!!f.is_club_goal} onChange={(e) => setF({ ...f, is_club_goal: e.target.checked })} /> Course objectif club (mise en avant)</label>
        {isUpcoming(f) && <label className="check"><input id="r-warn" type="checkbox" checked={warn} onChange={(e) => setWarn(e.target.checked)} /> {f.id ? 'Prévenir les adhérents de la modification' : 'Annoncer la course par notification'}</label>}
        <div className="form-actions">
          {f.id && <ConfirmDelete label="Supprimer la course" onConfirm={async () => { if (await run(() => api.deleteRace(f.id), 'Course supprimée')) { onClose(); onDeleted?.() } }} />}
          <button className="btn btn-primary grow" type="submit">{f.id ? 'Enregistrer' : isUpcoming(f) ? 'Créer la course' : 'Créer et saisir les résultats'}</button>
        </div>
      </form>
    </Sheet>
  )
}

function ResultForm({ initial, race, onClose }) {
  const { run, profiles, results } = useData()
  const taken = new Set(results.filter((r) => r.race_id === race.id && r.id !== initial.id).map((r) => r.member_id))
  const knownFinishers = results.find((r) => r.race_id === race.id && r.finishers)?.finishers
  const blank = { member_id: '', time: '', dnf: false, rank_overall: '', finishers: knownFinishers || '', podium: '', note: '' }
  const fromRow = (r) => ({
    ...blank, ...r,
    time: r.time_seconds ? fmtTime(r.time_seconds) : '',
    dnf: r.id ? r.time_seconds == null : false,
    rank_overall: r.rank_overall ?? '', finishers: r.finishers ?? knownFinishers ?? '', podium: r.podium ?? '', note: r.note ?? '',
  })
  const [f, setF] = useState(fromRow(initial))
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const members = [...profiles].sort((a, b) => a.last_name.localeCompare(b.last_name))

  const save = async (again) => {
    const secs = f.dnf ? null : parseTime(f.time)
    if (!f.member_id) return setErr('Choisis un adhérent.')
    if (!f.dnf && !secs) return setErr('Temps invalide : écris-le au format 1:23:45 ou 45:30.')
    setErr('')
    const row = {
      id: f.id, race_id: race.id, member_id: f.member_id, time_seconds: secs,
      rank_overall: f.dnf || !f.rank_overall ? null : Number(f.rank_overall),
      finishers: f.finishers ? Number(f.finishers) : null,
      podium: f.dnf || !f.podium ? null : Number(f.podium),
      note: f.note || null,
    }
    if (!row.id) delete row.id
    if (await run(() => api.saveResult(row), 'Résultat enregistré')) {
      if (again) setF({ ...blank, finishers: f.finishers })
      else onClose()
    }
  }

  return (
    <Sheet title={f.id ? 'Modifier le résultat' : `Résultat · ${race.name}`} onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); save(false) }}>
        <Field label="Adhérent">
          <select id="x-member" value={f.member_id} onChange={set('member_id')} required>
            <option value="">Choisir…</option>
            {members.map((p) => <option key={p.id} value={p.id} disabled={taken.has(p.id)}>{p.last_name} {p.first_name}{taken.has(p.id) ? ' (déjà saisi)' : ''}</option>)}
          </select>
        </Field>
        <div className="row2">
          <Field label="Temps" hint="h:mm:ss ou mm:ss">
            <input id="x-time" inputMode="numeric" value={f.time} onChange={set('time')} disabled={f.dnf} placeholder="1:42:18" />
          </Field>
          <label className="check"><input id="x-dnf" type="checkbox" checked={f.dnf} onChange={set('dnf')} /> Abandon (DNF)</label>
        </div>
        <div className="row2">
          <Field label="Classement scratch"><input id="x-rank" type="number" min="1" value={f.rank_overall} onChange={set('rank_overall')} disabled={f.dnf} /></Field>
          <Field label="Nb de classés"><input id="x-fin" type="number" min="1" value={f.finishers} onChange={set('finishers')} /></Field>
        </div>
        <Field label="Podium catégorie">
          <div className="segmented small">
            {[['', 'Non'], ['1', '1er'], ['2', '2e'], ['3', '3e']].map(([v, l]) => (
              <button type="button" key={v} disabled={f.dnf} className={String(f.podium) === v ? 'on' : ''} onClick={() => setF({ ...f, podium: v })}>{l}</button>
            ))}
          </div>
        </Field>
        <Field label="Commentaire (optionnel)"><input id="x-note" value={f.note} onChange={set('note')} placeholder="Record perso !" /></Field>
        {err && <p className="form-error">{err}</p>}
        <div className="form-actions">
          {f.id
            ? <ConfirmDelete onConfirm={async () => (await run(() => api.deleteResult(f.id), 'Résultat supprimé')) && onClose()} />
            : <button type="button" className="btn btn-ghost" onClick={() => save(true)}>Enregistrer + suivant</button>}
          <button className="btn btn-primary grow" type="submit">Enregistrer</button>
        </div>
      </form>
    </Sheet>
  )
}
