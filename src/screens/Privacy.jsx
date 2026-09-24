import { useState } from 'react'
import { api } from '../api/index.js'
import { CLUB } from '../config.js'
import { download } from '../lib/download.js'
import { fmtTime } from '../lib/format.js'
import { useData } from '../store.jsx'
import { ConfirmDelete, Icon, Logo, PageHead, Sheet } from '../ui.jsx'

// Date à changer à chaque modification du texte ci-dessous
const UPDATED = '24 septembre 2026'

// Page « Données personnelles », lisible même sans être connecté (lien depuis l'écran de connexion)
export default function Privacy({ standalone }) {
  const data = useData()
  const { me } = data
  const [del, setDel] = useState(false)
  const contact = CLUB.privacyContact
    ? <>écris à <a href={`mailto:${CLUB.privacyContact}`}>{CLUB.privacyContact}</a> ou parles-en à un coach</>
    : <>parles-en à un coach ou au bureau du club</>

  return (
    <>
      {standalone && <a className="link-btn" href="#/">← Retour</a>}
      <PageHead back={!standalone} kicker="Confidentialité" title="Tes données" />

      {me && (
        <section className="data-actions">
          <button className="btn btn-ghost" onClick={() => exportMyData(data)}><Icon name="download" size={18} /> Télécharger mes données</button>
          <button className="btn btn-danger" onClick={() => setDel(true)}><Icon name="trash" size={18} /> Supprimer mon compte</button>
        </section>
      )}

      <article className="legal">
        <h2>En bref</h2>
        <p>
          L'app sert à organiser la vie sportive du club : séances, courses, résultats et challenge.
          Tes données restent entre adhérents du club. Elles ne sont ni vendues, ni utilisées pour de la publicité,
          et tu peux tout supprimer toi-même, à tout moment.
        </p>

        <h2>Qui est responsable ?</h2>
        <p>L'association {CLUB.fullName}. L'app est développée et maintenue bénévolement par un adhérent du club.</p>

        <h2>Ce que l'app enregistre</h2>
        <ul>
          <li><strong>Ton compte</strong> : e-mail et mot de passe (chiffré, personne ne peut le lire).</li>
          <li><strong>Ton profil</strong> : prénom, nom, et si tu les renseignes : photo, ville, disciplines, VMA.</li>
          <li><strong>Ta vie au club</strong> : tes réponses aux séances, tes inscriptions aux courses, tes résultats (temps, classement, podium).</li>
          <li><strong>Les notifications</strong>, si tu les actives : un identifiant technique de ton appareil.</li>
        </ul>
        <p>
          Pour un adhérent qui n'a pas de compte, un coach peut créer une fiche avec son nom et ses résultats,
          pour qu'il figure au challenge. Cette personne peut demander à un coach de la supprimer, ou la récupérer
          en créant son compte.
        </p>

        <h2>Pourquoi ?</h2>
        <p>
          Pour que les coachs sachent qui vient, pour afficher les résultats et le challenge du club, et pour te prévenir
          des séances et des courses. Rien d'autre. Ces données sont traitées parce que tu t'inscris volontairement,
          et dans l'intérêt de l'association pour organiser ses activités.
        </p>

        <h2>Qui peut les voir ?</h2>
        <ul>
          <li><strong>Les adhérents du club</strong>, une fois leur compte validé par un coach : ton profil, tes résultats, tes présences et tes inscriptions.</li>
          <li><strong>Les coachs</strong> peuvent en plus modifier les profils et saisir les résultats.</li>
          <li><strong>Ton e-mail</strong> n'est affiché nulle part dans l'app. Seule la personne qui administre la base technique peut le voir.</li>
          <li>Personne en dehors du club : un compte non validé ne voit rien.</li>
        </ul>

        <h2>Où sont-elles stockées ?</h2>
        <p>
          Chez Supabase, sur des serveurs situés à Paris (Union européenne). Si tu actives les notifications, leur texte transite
          par le service de notifications de ton téléphone ou navigateur (Apple, Google ou Mozilla).
        </p>

        <h2>Combien de temps ?</h2>
        <p>
          Tant que ton compte existe. Quand tu le supprimes, tout est effacé immédiatement et définitivement.
          Si tu quittes le club, pense à supprimer ton compte.
        </p>

        <h2>Cookies</h2>
        <p>
          Aucun cookie publicitaire ni de mesure d'audience. L'app garde seulement ta connexion sur ton appareil,
          pour que tu n'aies pas à te reconnecter à chaque fois.
        </p>

        <h2>Tes droits</h2>
        <ul>
          <li><strong>Consulter</strong> tes données : bouton « Télécharger mes données » en haut de cette page.</li>
          <li><strong>Les corriger</strong> : depuis ton profil, bouton « Modifier ».</li>
          <li><strong>Les effacer</strong> : bouton « Supprimer mon compte » en haut de cette page.</li>
          <li>Pour toute autre question, {contact}.</li>
        </ul>
        <p>
          Si tu estimes que tes droits ne sont pas respectés, tu peux adresser une réclamation à la CNIL
          (<a href="https://www.cnil.fr" target="_blank" rel="noreferrer">cnil.fr</a>).
        </p>

        <p className="legal-date">Dernière mise à jour : {UPDATED}</p>
      </article>

      {del && me && <DeleteAccount onClose={() => setDel(false)} />}
    </>
  )
}

function DeleteAccount({ onClose }) {
  const data = useData()
  const { me, profiles, setToast, reload } = data
  const [busy, setBusy] = useState(false)
  const lastCoach = me.is_admin && profiles.filter((p) => p.is_admin).length === 1

  const remove = async () => {
    setBusy(true)
    try {
      await api.deleteMyAccount(me.id)
      window.location.hash = '/'
      await reload()
      setToast({ text: 'Ton compte et tes données ont été supprimés' })
    } catch (e) {
      setToast({ text: e.message, error: true })
      setBusy(false)
    }
  }

  return (
    <Sheet title="Supprimer mon compte" onClose={onClose}>
      <div className="form">
        <p className="muted-p">Tout ce qui est lié à ton compte sera effacé <strong>définitivement</strong> :</p>
        <ul className="legal-list">
          <li>ton profil et ta photo ;</li>
          <li>tes résultats (tu disparais du challenge et des classements des courses) ;</li>
          <li>tes réponses aux séances et tes inscriptions aux courses ;</li>
          <li>tes notifications.</li>
        </ul>
        <p className="muted-p">Il n'y a pas de retour en arrière possible. Tu peux d'abord télécharger tes données pour les garder.</p>
        {lastCoach ? (
          <p className="form-error">Tu es le seul coach : nomme un autre coach avant de supprimer ton compte.</p>
        ) : (
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => exportMyData(data)}><Icon name="download" size={18} /> Mes données</button>
            {busy ? <button className="btn btn-danger" disabled>Suppression…</button> : <ConfirmDelete label="Supprimer définitivement" onConfirm={remove} />}
          </div>
        )}
      </div>
    </Sheet>
  )
}

// Export au format JSON de tout ce que l'app sait de l'adhérent (droit d'accès RGPD)
async function exportMyData({ me, sessions, races, results, attendance, registrations }) {
  const email = await api.myEmail()
  const session = Object.fromEntries(sessions.map((s) => [s.id, s]))
  const race = Object.fromEntries(races.map((r) => [r.id, r]))
  const mine = (rows) => rows.filter((r) => r.member_id === me.id)
  const data = {
    exporte_le: new Date().toISOString(),
    compte: { email },
    profil: {
      prenom: me.first_name, nom: me.last_name, ville: me.city, disciplines: me.disciplines,
      vma: me.vma, photo: me.avatar_url, coach: me.is_admin, compte_valide: me.approved ?? true,
    },
    presences_seances: mine(attendance).map((a) => ({
      seance: session[a.session_id]?.title, date: session[a.session_id]?.starts_at, reponse: a.status,
    })),
    inscriptions_courses: mine(registrations).map((r) => ({
      course: race[r.race_id]?.name, format: race[r.race_id]?.format, date: race[r.race_id]?.race_date, statut: r.status,
    })),
    resultats: mine(results).map((r) => ({
      course: race[r.race_id]?.name, date: race[r.race_id]?.race_date, distance_km: race[r.race_id]?.distance_km,
      temps: r.time_seconds ? fmtTime(r.time_seconds) : 'abandon', classement: r.rank_overall, classes: r.finishers,
      podium: r.podium, commentaire: r.note,
    })),
  }
  download('asoa-mes-donnees.json', JSON.stringify(data, null, 2), 'application/json')
}

// Écran d'un compte créé mais pas encore validé par un coach
export function Pending() {
  const { me, reload } = useData()
  const [busy, setBusy] = useState(false)
  const check = async () => {
    setBusy(true)
    await reload()
    setBusy(false)
  }
  return (
    <div className="login">
      <div className="login-hero"><Logo big /><p>Bienvenue au club</p></div>
      <div className="form login-card">
        <h1>Presque prêt, {me.first_name} !</h1>
        <p className="muted-p">
          Un coach doit valider ton compte avant que tu accèdes aux séances, aux courses et aux résultats.
          Comme ça, seuls les adhérents du club voient les infos des autres.
        </p>
        <p className="muted-p">Pour aller plus vite, préviens un coach à la prochaine séance.</p>
        <button className="btn btn-primary" onClick={check} disabled={busy}>{busy ? '…' : 'Vérifier à nouveau'}</button>
        <div className="login-links">
          <button type="button" className="link-btn" onClick={() => api.signOut()}>Se déconnecter</button>
          <a className="link-btn" href="#/confidentialite">Mes données</a>
        </div>
      </div>
    </div>
  )
}
