import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/index.js'
import { CLUB, DISCIPLINES } from '../config.js'
import { standings } from '../lib/challenge.js'
import { fmtTime, fullDate, fullName, km, seasonOf } from '../lib/format.js'
import { go, useData } from '../store.jsx'
import { Avatar, DiscChip, Empty, Field, Icon, PageHead, Sheet } from '../ui.jsx'
import { Medal } from './Races.jsx'
import { badgesFor } from '../lib/badges.js'
import { RECORD_DISTANCES, personalRecords } from '../lib/records.js'
import { disablePush, enablePush, isIOS, pushState } from '../lib/push.js'
import { VMA_ZONES, fmtVma, paceAt } from '../lib/vma.js'

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
              {p.vma && <span className="t-vma">VMA {fmtVma(p.vma)}</span>}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

export function MemberDetail({ id, self }) {
  const { profiles, races, results, me, isAdmin, attendance, sessions } = useData()
  const [edit, setEdit] = useState(false)
  const [showLocked, setShowLocked] = useState(false)
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
    return {
      mine, seasonRank: s?.rank, seasonKm: s?.total || 0, totalKm, podiums: mine.filter((r) => r.podium).length,
      records: personalRecords(id, results, races),
      badges: badgesFor(id, { results, races, attendance, sessions }),
    }
  }, [p, races, results, profiles, id, season, attendance, sessions])

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

      {p.vma ? (
        <section className="vma-box">
          <div className="vma-head">
            <span className="vma-value">{fmtVma(p.vma)}<small>VMA</small></span>
            {canEdit && <button className="link-btn" onClick={() => setEdit(true)}>Mettre à jour</button>}
          </div>
          <ul className="vma-zones">
            {VMA_ZONES.map((z) => <li key={z.pct}><strong>{paceAt(p.vma, z.pct)}</strong><small>{z.label}</small></li>)}
          </ul>
        </section>
      ) : canEdit && (
        <button className="vma-empty" onClick={() => setEdit(true)}>
          <strong>Renseigne ta VMA</strong>
          <small>Elle sert au coach pour les allures en séance, et tu la retrouveras ici.</small>
        </button>
      )}

      {self && <PushSettings />}

      <h2 className="section-title">Records perso</h2>
      <dl className="records">
        {RECORD_DISTANCES.map((d) => {
          const r = data.records[d.key]
          return (
            <div key={d.key} className={r ? '' : 'empty-rec'} onClick={() => r && go(`courses/${r.race_id}`)}>
              <dt>{d.label}</dt>
              <dd>{r ? fmtTime(r.time_seconds) : '—'}</dd>
              {r && <small>{r.race.name} · {new Date(r.race.race_date).getFullYear()}</small>}
            </div>
          )
        })}
      </dl>

      <div className="table-head">
        <h2 className="section-title">Badges <small className="count">{data.badges.filter((b) => b.earned).length}/{data.badges.length}</small></h2>
        <button className="link-btn" onClick={() => setShowLocked(!showLocked)}>{showLocked ? 'Masquer ceux à gagner' : 'Voir ceux à gagner'}</button>
      </div>
      <ul className="badges">
        {data.badges.filter((b) => b.earned || showLocked).map((b) => (
          <li key={b.id} className={b.earned ? 'earned' : 'locked'} title={b.desc}>
            <span className="b-icon" aria-hidden="true">{b.icon}</span>
            <strong>{b.name}</strong>
            <small>{b.desc}</small>
            {!b.earned && b.goal > 1 && <span className="b-bar"><span style={{ width: `${(b.value / b.goal) * 100}%` }} /></span>}
            {!b.earned && b.goal > 1 && <small className="b-prog">{Math.floor(b.value)}/{b.goal}</small>}
          </li>
        ))}
      </ul>
      {!showLocked && data.badges.every((b) => !b.earned) && <Empty>Pas encore de badge. Le premier arrive avec la première course !</Empty>}

      <h2 className="section-title">Résultats</h2>
      {data.mine.length === 0 ? <Empty>Aucun résultat pour l'instant.</Empty> : (
        <ul className="race-list">
          {data.mine.map((r) => (
            <li key={r.id}>
              <button className="race-row" onClick={() => go(`courses/${r.race_id}`)}>
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
          <a className="btn btn-ghost" href="#/confidentialite">Mes données</a>
          {api.isDemo && <button className="btn btn-ghost" onClick={() => { api.signOut(); api.demoSignIn(me.is_admin ? 'member' : 'admin') }}>Passer en vue {me.is_admin ? 'adhérent' : 'coach'}</button>}
        </div>
      )}
      {edit && <ProfileForm p={p} onClose={() => setEdit(false)} />}
    </>
  )
}

function PushSettings() {
  const { setToast, notify } = useData()
  const [state, setState] = useState('loading')
  const [busy, setBusy] = useState(false)
  useEffect(() => { pushState().then(setState).catch(() => setState('unsupported')) }, [])
  const toggle = async () => {
    setBusy(true)
    try {
      if (state === 'on') await disablePush()
      else await enablePush()
      const next = await pushState()
      setState(next)
      setToast({ text: next === 'on' ? 'Notifications activées sur cet appareil' : 'Notifications désactivées' })
    } catch (e) {
      setToast({ text: e.message, error: true })
      setState(await pushState())
    }
    setBusy(false)
  }
  const text = {
    loading: '…',
    demo: 'En démo, les notifications sont simulées. Elles fonctionneront une fois l\'app en ligne.',
    'not-configured': 'Les notifications ne sont pas encore configurées (clé VAPID manquante).',
    'needs-install': 'Sur iPhone, ajoute d\'abord l\'app à l\'écran d\'accueil (Safari › Partager › « Sur l\'écran d\'accueil »), puis ouvre-la depuis l\'icône.',
    unsupported: 'Ce navigateur ne gère pas les notifications.',
    denied: `Tu as bloqué les notifications. Réactive-les dans les réglages ${isIOS() ? 'de l\'iPhone (Notifications › ASOA)' : 'du navigateur pour ce site'}.`,
    off: 'Séances publiées ou annulées, rappel la veille, nouvelles courses, résultats en ligne.',
    on: 'Activées sur cet appareil.',
  }[state]
  return (
    <section className="push-box">
      <span className="push-icon"><Icon name="bell" size={22} /></span>
      <div>
        <strong>Notifications</strong>
        <p>{text}</p>
      </div>
      {state === 'on' && <button className="btn btn-ghost" onClick={() => notify('test')}>Tester</button>}
      {(state === 'on' || state === 'off') && (
        <button className={`btn ${state === 'on' ? 'btn-ghost' : 'btn-primary'}`} onClick={toggle} disabled={busy}>
          {busy ? '…' : state === 'on' ? 'Désactiver' : 'Activer'}
        </button>
      )}
    </section>
  )
}

function ProfileForm({ p, onClose }) {
  const { run, me } = useData()
  const [f, setF] = useState({ first_name: p.first_name, last_name: p.last_name, city: p.city || '', disciplines: p.disciplines || [], avatar_url: p.avatar_url, vma: p.vma ?? '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
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
    const vma = String(f.vma).replace(',', '.').trim()
    if (vma && (isNaN(Number(vma)) || Number(vma) < 5 || Number(vma) > 30)) return setErr('VMA attendue entre 5 et 30 km/h.')
    setErr('')
    if (await run(() => api.updateProfile(p.id, { ...f, vma: vma ? Number(vma) : null }), 'Profil mis à jour')) onClose()
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
        <div className="row2">
          <Field label="Ville"><input id="p-city" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
          <Field label="VMA (km/h)" hint={f.vma ? `100 % = ${paceAt(Number(String(f.vma).replace(',', '.')))}/km` : 'Optionnel, ex. 16,5'}>
            <input id="p-vma" inputMode="decimal" value={f.vma} onChange={(e) => setF({ ...f, vma: e.target.value })} placeholder="16,5" />
          </Field>
        </div>
        <Field label="Disciplines pratiquées">
          <div className="segmented small multi">
            {Object.entries(DISCIPLINES).map(([k, v]) => (
              <button type="button" key={k} className={f.disciplines.includes(k) ? 'on' : ''} onClick={() => toggle(k)} aria-pressed={f.disciplines.includes(k)}>{v.label}</button>
            ))}
          </div>
        </Field>
        {err && <p className="form-error">{err}</p>}
        <div className="form-actions"><button className="btn btn-primary grow" type="submit">Enregistrer</button></div>
      </form>
    </Sheet>
  )
}
