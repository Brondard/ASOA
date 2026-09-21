import { useMemo, useRef, useState } from 'react'
import { api } from '../api/index.js'
import { CLUB, DISCIPLINES } from '../config.js'
import { standings } from '../lib/challenge.js'
import { fmtTime, fullDate, fullName, km, seasonOf } from '../lib/format.js'
import { go, useData } from '../store.jsx'
import { Avatar, DiscChip, Empty, Field, Icon, PageHead, Sheet } from '../ui.jsx'
import { Medal } from './Races.jsx'

export default function Members() {
  const { profiles } = useData()
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const n = q.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    return [...profiles]
      .sort((a, b) => a.first_name.localeCompare(b.first_name))
      .filter((p) => !n || fullName(p).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(n))
  }, [profiles, q])

  return (
    <>
      <PageHead kicker={`${profiles.length} adhérents`} title="Trombinoscope" />
      <input id="member-search" className="search" type="search" placeholder="Rechercher un adhérent" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 && <Empty>Personne ne correspond à « {q} ».</Empty>}
      <ul className="trombi">
        {list.map((p) => (
          <li key={p.id}>
            <button onClick={() => go(`membres/${p.id}`)}>
              <Avatar p={p} size={64} />
              <span className="t-name">{p.first_name}<br /><strong>{p.last_name}</strong></span>
              <span className="t-disc">{p.disciplines.map((d) => <DiscChip key={d} d={d} />)}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

export function MemberDetail({ id, self }) {
  const { profiles, races, results, me, isAdmin } = useData()
  const [edit, setEdit] = useState(false)
  const p = profiles.find((x) => x.id === id)
  const season = seasonOf(new Date())

  const data = useMemo(() => {
    if (!p) return null
    const raceById = Object.fromEntries(races.map((r) => [r.id, r]))
    const mine = results
      .filter((r) => r.member_id === id && raceById[r.race_id])
      .map((r) => ({ ...r, race: raceById[r.race_id] }))
      .sort((a, b) => b.race.race_date.localeCompare(a.race.race_date))
    const table = standings({ profiles, races, results, season })
    const s = table.find((r) => r.member_id === id)
    const totalKm = mine.filter((r) => r.time_seconds).reduce((a, r) => a + Number(r.race.distance_km), 0)
    return { mine, seasonRank: s?.rank, seasonKm: s?.total || 0, totalKm, podiums: mine.filter((r) => r.podium).length }
  }, [p, races, results, profiles, id, season])

  if (!p) return <><PageHead back title="Adhérent introuvable" /></>
  const canEdit = p.id === me.id || isAdmin

  return (
    <>
      {self ? <PageHead kicker={CLUB.fullName} title="Mon profil" /> : <PageHead back kicker="Adhérent" title={fullName(p)} />}
      <section className="profile-card">
        <Avatar p={p} size={96} />
        <div className="profile-id">
          <h2>{p.first_name} <strong>{p.last_name}</strong></h2>
          {p.city && <p className="muted"><Icon name="pin" size={15} /> {p.city}</p>}
          <div className="t-disc">{p.disciplines.map((d) => <DiscChip key={d} d={d} />)}{p.is_admin && <span className="chip chip-coach">Coach</span>}</div>
        </div>
        {canEdit && <button className="btn btn-ghost" onClick={() => setEdit(true)}><Icon name="edit" size={16} /> Modifier</button>}
      </section>

      <dl className="stats">
        <div><dt>Courses</dt><dd>{data.mine.length}</dd></div>
        <div><dt>Km en course</dt><dd>{km(data.totalKm)}</dd></div>
        <div><dt>Podiums</dt><dd>{data.podiums}</dd></div>
        <div><dt>Challenge {season.slice(2, 4)}-{season.slice(7)}</dt><dd>{data.seasonRank ? `${data.seasonRank}e` : '–'}</dd></div>
      </dl>

      <h2 className="section-title">Résultats</h2>
      {data.mine.length === 0 ? <Empty>Aucun résultat pour l'instant.</Empty> : (
        <ul className="race-list">
          {data.mine.map((r) => (
            <li key={r.id}>
              <button className="race-row" onClick={() => go(`resultats/${r.race_id}`)}>
                <span className="race-date">{fullDate(r.race.race_date)}</span>
                <span className="race-name">{r.race.name}</span>
                <span className="race-meta"><DiscChip d={r.race.discipline} /> {r.race.format || `${km(r.race.distance_km)} km`}</span>
                <span className="race-my">
                  <strong>{fmtTime(r.time_seconds)}</strong>
                  {r.rank_overall && <small>{r.rank_overall}e{r.finishers ? `/${r.finishers}` : ''}</small>}
                  <Medal n={r.podium} />
                </span>
                <span className="race-chev"><Icon name="chevron" size={18} /></span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {self && (
        <div className="signout">
          <button className="btn btn-ghost" onClick={() => api.signOut()}><Icon name="logout" size={18} /> Se déconnecter</button>
          {api.isDemo && <button className="btn btn-ghost" onClick={() => { api.signOut(); api.demoSignIn(me.is_admin ? 'member' : 'admin') }}>Passer en vue {me.is_admin ? 'adhérent' : 'coach'}</button>}
        </div>
      )}
      {edit && <ProfileForm p={p} onClose={() => setEdit(false)} />}
    </>
  )
}

function ProfileForm({ p, onClose }) {
  const { run, me } = useData()
  const [f, setF] = useState({ first_name: p.first_name, last_name: p.last_name, city: p.city || '', disciplines: p.disciplines || [], avatar_url: p.avatar_url })
  const [busy, setBusy] = useState(false)
  const file = useRef()
  const toggle = (d) => setF({ ...f, disciplines: f.disciplines.includes(d) ? f.disciplines.filter((x) => x !== d) : [...f.disciplines, d] })
  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    const url = await run(() => api.uploadAvatar(file, p.id))
    setBusy(false)
    if (url) setF((f) => ({ ...f, avatar_url: url }))
  }
  const submit = async (e) => {
    e.preventDefault()
    if (await run(() => api.updateProfile(p.id, f), 'Profil mis à jour')) onClose()
  }
  return (
    <Sheet title={p.id === me.id ? 'Mon profil' : `Profil de ${p.first_name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="avatar-edit">
          <Avatar p={{ ...p, ...f }} size={80} />
          <button type="button" className="btn btn-ghost" onClick={() => file.current.click()} disabled={busy}>
            <Icon name="camera" size={18} /> {busy ? 'Envoi…' : 'Changer la photo'}
          </button>
          <input ref={file} type="file" accept="image/*" hidden onChange={onFile} />
        </div>
        <div className="row2">
          <Field label="Prénom"><input id="p-first" required value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} /></Field>
          <Field label="Nom"><input id="p-last" required value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} /></Field>
        </div>
        <Field label="Ville"><input id="p-city" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
        <Field label="Disciplines pratiquées">
          <div className="segmented small multi">
            {Object.entries(DISCIPLINES).map(([k, v]) => (
              <button type="button" key={k} className={f.disciplines.includes(k) ? 'on' : ''} onClick={() => toggle(k)} aria-pressed={f.disciplines.includes(k)}>{v.label}</button>
            ))}
          </div>
        </Field>
        <div className="form-actions"><button className="btn btn-primary grow" type="submit">Enregistrer</button></div>
      </form>
    </Sheet>
  )
}
