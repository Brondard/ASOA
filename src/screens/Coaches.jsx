import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/index.js'
import { fullDate, fullName } from '../lib/format.js'
import { go, useData } from '../store.jsx'
import { Avatar, Empty, Field, Icon, PageHead, Sheet } from '../ui.jsx'

const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

export default function Coaches() {
  const { profiles, pending, me, run } = useData()
  const [q, setQ] = useState('')
  const [addGuest, setAddGuest] = useState(false)
  const byName = (a, b) => a.first_name.localeCompare(b.first_name)
  const coaches = useMemo(() => profiles.filter((p) => p.is_admin).sort(byName), [profiles])
  const guests = useMemo(() => profiles.filter((p) => p.guest).sort(byName), [profiles])
  const members = useMemo(() => {
    const n = normalize(q.trim())
    return profiles.filter((p) => !p.is_admin && !p.guest && (!n || normalize(fullName(p)).includes(n))).sort(byName)
  }, [profiles, q])

  const setCoach = (p, value) =>
    run(() => api.setCoach(p.id, value), value ? `${p.first_name} est maintenant coach` : `${p.first_name} n'est plus coach`)

  return (
    <>
      <PageHead kicker="Gestion du club" title="Espace coach" />

      {pending.length > 0 && (
        <>
          <h2 className="section-title">À valider <small className="count">{pending.length}</small></h2>
          <p className="hint">Vérifie que la personne fait bien partie du club. Refuser supprime son compte.</p>
          <ul className="role-list">
            {pending.map((p) => <PendingRow key={p.id} p={p} guests={guests} />)}
          </ul>
        </>
      )}

      <div className="table-head">
        <h2 className="section-title">Sans compte <small className="count">{guests.length}</small></h2>
        <button className="btn btn-ghost" onClick={() => setAddGuest(true)}><Icon name="plus" size={16} /> Ajouter</button>
      </div>
      <p className="hint">
        Pour qu'un adhérent qui n'utilise pas l'app figure au challenge : crée sa fiche, puis saisis ses résultats
        comme pour les autres. S'il crée un compte plus tard, relie sa fiche à son compte au moment de le valider.
      </p>
      {guests.length > 0 && (
        <ul className="role-list">
          {guests.map((p) => (
            <li key={p.id}>
              <Person p={p} />
              <ConfirmButton label="Supprimer" confirm="Confirmer" onConfirm={() => run(() => api.deleteGuest(p.id), `Fiche de ${p.first_name} supprimée`)} />
            </li>
          ))}
        </ul>
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
      {addGuest && <GuestForm onClose={() => setAddGuest(false)} />}
    </>
  )
}

// Inscription en attente : valider, refuser, ou relier à une fiche sans compte existante
function PendingRow({ p, guests }) {
  const { run } = useData()
  // Fiche au même nom : on la propose d'office
  const twin = guests.find((g) => normalize(fullName(g)) === normalize(fullName(p)))
  const [guestId, setGuestId] = useState(twin?.id || '')
  const guest = guests.find((g) => g.id === guestId)
  return (
    <li className="pending-row">
      <div className="pending-main">
        <Person p={p} pending />
        <ConfirmButton label="Refuser" confirm="Confirmer" onConfirm={() => run(() => api.refuseMember(p.id), `Inscription de ${p.first_name} refusée`)} />
        {!guest && <ConfirmButton label="Valider" primary once onConfirm={() => run(() => api.approveMember(p.id), `${p.first_name} a accès à l'app`)} />}
      </div>
      {guests.length > 0 && (
        <div className="pending-link">
          <label>
            <span>{twin ? 'Une fiche sans compte porte ce nom :' : 'Déjà une fiche sans compte ?'}</span>
            <select value={guestId} onChange={(e) => setGuestId(e.target.value)} aria-label={`Fiche sans compte de ${p.first_name}`}>
              <option value="">Non, nouvel adhérent</option>
              {guests.map((g) => <option key={g.id} value={g.id}>{fullName(g)}</option>)}
            </select>
          </label>
          {guest && (
            <ConfirmButton label="Relier et valider" confirm="Confirmer" primary
              onConfirm={() => run(() => api.linkGuest(guest.id, p.id), `${p.first_name} a récupéré la fiche et ses résultats`)} />
          )}
        </div>
      )}
    </li>
  )
}

function GuestForm({ onClose }) {
  const { run } = useData()
  const [f, setF] = useState({ first_name: '', last_name: '' })
  const submit = async (e) => {
    e.preventDefault()
    const p = { first_name: f.first_name.trim(), last_name: f.last_name.trim() }
    if (await run(() => api.createGuest(p), `Fiche de ${p.first_name} créée`)) onClose()
  }
  return (
    <Sheet title="Adhérent sans compte" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="row2">
          <Field label="Prénom"><input id="g-first" required value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} /></Field>
          <Field label="Nom"><input id="g-last" required value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} /></Field>
        </div>
        <p className="hint">Tu pourras compléter sa fiche (photo, ville, disciplines, VMA) depuis le trombinoscope.</p>
        <div className="form-actions"><button className="btn btn-primary grow" type="submit">Créer la fiche</button></div>
      </form>
    </Sheet>
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
