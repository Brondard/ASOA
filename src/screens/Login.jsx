import { useState } from 'react'
import { api } from '../api/index.js'
import { useData } from '../store.jsx'
import { Field, Logo } from '../ui.jsx'

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.3z" />
    <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.2l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.3 15.5 46 24 46z" />
    <path fill="#FBBC05" d="M11.8 28.4c-.4-1.3-.7-2.7-.7-4.4s.3-3 .7-4.4v-5.7H4.5C2.9 17.1 2 20.4 2 24s.9 6.9 2.5 10.1l7.3-5.7z" />
    <path fill="#EA4335" d="M24 10.5c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 3.9 29.9 2 24 2 15.5 2 8.1 6.7 4.5 13.9l7.3 5.7c1.7-5.2 6.5-9.1 12.2-9.1z" />
  </svg>
)

export default function Login() {
  const [mode, setMode] = useState('in') // in | up | reset
  const [f, setF] = useState({ email: '', password: '', first_name: '', last_name: '' })
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const google = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await api.signInWithGoogle() // redirige vers Google
    } catch (err) {
      setMsg({ text: err.message })
      setBusy(false)
    }
  }

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
        {mode !== 'reset' && (
          <>
            <button type="button" className="btn btn-google" disabled={busy} onClick={google}>
              <GoogleG /> Continuer avec Google
            </button>
            <p className="or"><span>ou avec un e-mail</span></p>
          </>
        )}
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
        {mode === 'up' && <p className="hint">Un coach validera ton compte pour vérifier que tu fais partie du club.</p>}
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

      <a className="login-privacy" href="#/confidentialite">Données personnelles et confidentialité</a>

      {api.isDemo && (
        <div className="demo-box">
          <p><strong>Mode démo</strong> — données fictives, rien n'est enregistré.</p>
          <div className="row2">
            <button className="btn btn-dark" onClick={() => api.demoSignIn('member')}>Démo adhérent</button>
            <button className="btn btn-dark" onClick={() => api.demoSignIn('admin')}>Démo coach</button>
          </div>
          <button className="link-btn" onClick={() => api.demoSignIn('pending')}>Démo nouvel inscrit (compte à valider)</button>
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

// Premier passage après une connexion Google qui n'a pas fourni de prénom/nom :
// sans nom, le coach ne saurait pas qui il valide
export function CompleteProfile() {
  const { me, reload, setToast } = useData()
  const [f, setF] = useState({ first_name: me.first_name || '', last_name: me.last_name || '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.updateProfile(me.id, { first_name: f.first_name.trim(), last_name: f.last_name.trim() })
      setToast({ text: 'Bienvenue au club !' })
      await reload()
    } catch (e2) {
      setErr(e2.message)
      setBusy(false)
    }
  }
  return (
    <div className="login">
      <div className="login-hero"><Logo big /><p>Bienvenue</p></div>
      <form className="form login-card" onSubmit={submit}>
        <h1>Comment tu t'appelles ?</h1>
        <p className="field-hint">Ton nom apparaîtra sur les résultats, le trombinoscope et les listes de présence.</p>
        <div className="row2">
          <Field label="Prénom"><input id="cp-first" required value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} autoComplete="given-name" /></Field>
          <Field label="Nom"><input id="cp-last" required value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} autoComplete="family-name" /></Field>
        </div>
        {err && <p className="form-error">{err}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? '…' : 'C\'est parti'}</button>
        <button type="button" className="link-btn" onClick={() => api.signOut()}>Se déconnecter</button>
      </form>
    </div>
  )
}
