import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/index.js'
import { fullDate, fullName } from '../lib/format.js'
import { go, useData } from '../store.jsx'
import { Avatar, Empty, PageHead } from '../ui.jsx'

const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

export default function Coaches() {
  const { profiles, pending, me, run } = useData()
  const [q, setQ] = useState('')
  const byName = (a, b) => a.first_name.localeCompare(b.first_name)
  const coaches = useMemo(() => profiles.filter((p) => p.is_admin).sort(byName), [profiles])
  const members = useMemo(() => {
    const n = normalize(q.trim())
    return profiles.filter((p) => !p.is_admin && (!n || normalize(fullName(p)).includes(n))).sort(byName)
  }, [profiles, q])

  const setCoach = (p, value) =>
    run(() => api.setCoach(p.id, value), value ? `${p.first_name} est maintenant coach` : `${p.first_name} n'est plus coach`)

  return (
    <>
      <PageHead kicker="Espace coach" title="Gérer les coachs" />

      {pending.length > 0 && (
        <>
          <h2 className="section-title">À valider <small className="count">{pending.length}</small></h2>
          <p className="hint">Vérifie que la personne fait bien partie du club. Refuser supprime son compte.</p>
          <ul className="role-list">
            {pending.map((p) => (
              <li key={p.id}>
                <Person p={p} pending />
                <ConfirmButton label="Refuser" confirm="Confirmer" onConfirm={() => run(() => api.refuseMember(p.id), `Inscription de ${p.first_name} refusée`)} />
                <ConfirmButton label="Valider" primary once onConfirm={() => run(() => api.approveMember(p.id), `${p.first_name} a accès à l'app`)} />
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="section-title">Coachs <small className="count">{coaches.length}</small></h2>
      <p className="hint">
        Un coach peut créer et modifier les séances, les courses et les résultats, modifier les profils,
        et nommer ou retirer d'autres coachs.
      </p>
      <ul className="role-list">
        {coaches.map((p) => (
          <li key={p.id}>
            <Person p={p} />
            {p.id === me.id
              ? <small className="muted">C'est toi</small>
              : <ConfirmButton label="Retirer" confirm="Confirmer" onConfirm={() => setCoach(p, false)} />}
          </li>
        ))}
      </ul>

      <h2 className="section-title">Nommer un coach</h2>
      <input id="coach-search" className="search" type="search" placeholder="Rechercher un adhérent" value={q} onChange={(e) => setQ(e.target.value)} />
      {members.length === 0 ? <Empty>{q ? `Personne ne correspond à « ${q} ».` : 'Tous les adhérents sont déjà coachs.'}</Empty> : (
        <ul className="role-list">
          {members.map((p) => (
            <li key={p.id}>
              <Person p={p} />
              <ConfirmButton label="Nommer coach" confirm="Confirmer" primary onConfirm={() => setCoach(p, true)} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

// Un compte en attente n'a pas encore de fiche adhérent : pas de lien
const Person = ({ p, pending }) => {
  const content = (
    <>
      <Avatar p={p} size={40} />
      <span>{fullName(p)}{pending && p.created_at && <small>Inscrit le {fullDate(p.created_at)}</small>}</span>
    </>
  )
  return pending
    ? <div className="role-who">{content}</div>
    : <button className="role-who" onClick={() => go(`membres/${p.id}`)}>{content}</button>
}

// Action en deux temps pour éviter le clic accidentel (once : un seul clic suffit)
function ConfirmButton({ label, confirm, onConfirm, primary, once }) {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  const click = async () => {
    if (!armed && !once) return setArmed(true)
    setBusy(true)
    await onConfirm()
    setBusy(false)
    setArmed(false)
  }
  return (
    <button type="button" className={`btn ${armed || once ? (primary ? 'btn-primary' : 'btn-danger armed') : 'btn-ghost'}`} onClick={click} disabled={busy}>
      {busy ? '…' : armed ? confirm : label}
    </button>
  )
}
