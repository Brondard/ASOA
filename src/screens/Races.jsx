import { useMemo, useState } from 'react'
import { api } from '../api/index.js'
import { DISCIPLINES } from '../config.js'
import { fmtTime, fullDate, fullName, km, pace, parseTime, seasonOf } from '../lib/format.js'
import { go, useData } from '../store.jsx'
import { Avatar, ConfirmDelete, DiscChip, Empty, Field, Icon, PageHead, Sheet } from '../ui.jsx'

export const Medal = ({ n }) => (n ? <span className={`medal medal-${n}`} title={`Podium catégorie : ${n}e`}>{n}</span> : null)

export default function Races() {
  const { races, results, me, isAdmin } = useData()
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
      if (mine && !myRes[r.id]) continue
      const s = seasonOf(r.race_date)
      const item = { ...r, n: count[r.id] || 0, my: myRes[r.id] }
      const g = out.at(-1)
      if (g?.season === s) g.items.push(item)
      else out.push({ season: s, items: [item] })
    }
    return out
  }, [races, results, me.id, mine])

  return (
    <>
      <PageHead
        kicker="Compétitions"
        title="Résultats"
        action={isAdmin && <button className="btn btn-primary" onClick={() => setEditing({})}><Icon name="plus" size={18} /> Course</button>}
      />
      <div className="segmented">
        <button className={!mine ? 'on' : ''} onClick={() => setMine(false)}>Tout le club</button>
        <button className={mine ? 'on' : ''} onClick={() => setMine(true)}>Mes résultats</button>
      </div>

      {bySeason.length === 0 && <Empty>{mine ? 'Tu n\'as pas encore de résultat enregistré.' : 'Aucune course pour l\'instant.'}</Empty>}

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

export function RaceDetail({ id }) {
  const { races, results, profiles, isAdmin, me } = useData()
  const [editRace, setEditRace] = useState(false)
  const [editRes, setEditRes] = useState(null)
  const race = races.find((r) => r.id === id)
  const rows = useMemo(() => {
    const byId = Object.fromEntries(profiles.map((p) => [p.id, p]))
    return results
      .filter((r) => r.race_id === id)
      .map((r) => ({ ...r, p: byId[r.member_id] }))
      .sort((a, b) => (a.time_seconds ?? Infinity) - (b.time_seconds ?? Infinity))
  }, [results, profiles, id])

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

      <div className="table-head">
        <h2>{rows.length} adhérent{rows.length > 1 ? 's' : ''} au départ</h2>
        {isAdmin && <button className="btn btn-primary" onClick={() => setEditRes({ race_id: id })}><Icon name="plus" size={18} /> Résultat</button>}
      </div>

      {rows.length === 0 ? <Empty>Aucun résultat saisi pour cette course.</Empty> : (
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
                  <td className="c-num strong">{fmtTime(r.time_seconds)}</td>
                  <td className="c-num">{r.rank_overall ? <>{r.rank_overall}{r.finishers && <small>/{r.finishers}</small>}</> : '–'}</td>
                  {race.discipline !== 'triathlon' && <td className="c-num hide-sm">{pace(r.time_seconds, race.distance_km) || '–'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {isAdmin && rows.length > 0 && <p className="hint">Touche une ligne pour la modifier.</p>}

      {editRace && <RaceForm initial={race} onClose={() => setEditRace(false)} onDeleted={() => go('resultats')} />}
      {editRes && <ResultForm initial={editRes} race={race} onClose={() => setEditRes(null)} />}
    </>
  )
}

function RaceForm({ initial, onClose, onDeleted }) {
  const { run } = useData()
  const [f, setF] = useState({ name: '', race_date: new Date().toISOString().slice(0, 10), location: '', discipline: 'running', format: '', distance_km: '', ...initial })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault()
    const saved = await run(() => api.saveRace({ ...f, distance_km: Number(String(f.distance_km).replace(',', '.')) }), f.id ? 'Course modifiée' : 'Course créée')
    if (saved) {
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
        <div className="form-actions">
          {f.id && <ConfirmDelete label="Supprimer la course" onConfirm={async () => { if (await run(() => api.deleteRace(f.id), 'Course supprimée')) { onClose(); onDeleted?.() } }} />}
          <button className="btn btn-primary grow" type="submit">{f.id ? 'Enregistrer' : 'Créer et saisir les résultats'}</button>
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
