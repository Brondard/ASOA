import { useState } from 'react'
import { api } from '../api/index.js'
import { useData } from '../store.jsx'
import { Field, Logo } from '../ui.jsx'

export default function Login() {
  const [mode, setMode] = useState('in') // in | up | reset
  const [f, setF] = useState({ email: '', password: '', first_name: '', last_name: '' })
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'in') await api.signIn(f.email, f.password)
      if (mode === 'up') {
        const { needsConfirmation } = await api.signUp(f)
        if (needsConfirmation) setMsg({ ok: true, text: 'Compte créé. Clique sur le lien reçu par e-mail pour l\'activer.' })
      }
      if (mode === 'reset') {
        await api.resetPassword(f.email)
        setMsg({ ok: true, text: 'Si un compte existe, un lien de réinitialisation vient de partir.' })
      }
    } catch (err) {
      setMsg({ text: err.message })
    }
    setBusy(false)
  }

  return (
    <div className="login">
      <div className="login-hero">
        <Logo big />
        <p>Course à pied · Trail · Triathlon</p>
      </div>

      <form className="form login-card" onSubmit={submit}>
        <h1>{mode === 'up' ? 'Créer mon compte' : mode === 'reset' ? 'Mot de passe oublié' : 'Connexion'}</h1>
        {mode === 'up' && (
          <div className="row2">
            <Field label="Prénom"><input id="l-first" required value={f.first_name} onChange={set('first_name')} autoComplete="given-name" /></Field>
            <Field label="Nom"><input id="l-last" required value={f.last_name} onChange={set('last_name')} autoComplete="family-name" /></Field>
          </div>
        )}
        <Field label="E-mail"><input id="l-email" type="email" required value={f.email} onChange={set('email')} autoComplete="email" /></Field>
        {mode !== 'reset' && (
          <Field label="Mot de passe" hint={mode === 'up' ? '6 caractères minimum' : null}>
            <input id="l-pass" type="password" required minLength={6} value={f.password} onChange={set('password')} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} />
          </Field>
        )}
        {msg && <p className={msg.ok ? 'form-ok' : 'form-error'}>{msg.text}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? '…' : mode === 'up' ? 'Créer mon compte' : mode === 'reset' ? 'Envoyer le lien' : 'Se connecter'}
        </button>
        <div className="login-links">
          {mode !== 'in' && <button type="button" className="link-btn" onClick={() => setMode('in')}>J'ai déjà un compte</button>}
          {mode !== 'up' && <button type="button" className="link-btn" onClick={() => setMode('up')}>Créer un compte</button>}
          {mode === 'in' && <button type="button" className="link-btn" onClick={() => setMode('reset')}>Mot de passe oublié ?</button>}
        </div>
      </form>

      {api.isDemo && (
        <div className="demo-box">
          <p><strong>Mode démo</strong> — données fictives, rien n'est enregistré.</p>
          <div className="row2">
            <button className="btn btn-dark" onClick={() => api.demoSignIn('member')}>Démo adhérent</button>
            <button className="btn btn-dark" onClick={() => api.demoSignIn('admin')}>Démo coach</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Écran affiché après un clic sur le lien « mot de passe oublié »
export function NewPassword() {
  const { setRecovery, setToast } = useData()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (pw !== pw2) return setErr('Les deux mots de passe ne sont pas identiques.')
    setBusy(true)
    try {
      await api.updatePassword(pw)
      setToast({ text: 'Mot de passe mis à jour' })
      history.replaceState(null, '', window.location.pathname + '#/seances')
      setRecovery(false)
    } catch (e2) {
      setErr(e2.message)
    }
    setBusy(false)
  }
  return (
    <div className="login">
      <div className="login-hero"><Logo big /><p>Nouveau mot de passe</p></div>
      <form className="form login-card" onSubmit={submit}>
        <h1>Choisis ton mot de passe</h1>
        <Field label="Nouveau mot de passe" hint="6 caractères minimum">
          <input id="np-1" type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Confirme-le">
          <input id="np-2" type="password" required minLength={6} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        </Field>
        {err && <p className="form-error">{err}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? '…' : 'Enregistrer et entrer'}</button>
      </form>
    </div>
  )
}
