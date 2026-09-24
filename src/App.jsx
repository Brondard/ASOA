import { api } from './api/index.js'
import Challenge from './screens/Challenge.jsx'
import Coaches from './screens/Coaches.jsx'
import Login, { NewPassword } from './screens/Login.jsx'
import Members, { MemberDetail } from './screens/Members.jsx'
import Privacy, { Pending } from './screens/Privacy.jsx'
import Races, { RaceDetail } from './screens/Races.jsx'
import Sessions from './screens/Sessions.jsx'
import { isMember, useData, useRoute } from './store.jsx'
import { Avatar, Icon, Logo } from './ui.jsx'

const TABS = [
  ['seances', 'Séances', 'calendar'],
  ['courses', 'Courses', 'medal'],
  ['challenge', 'Challenge', 'trophy'],
  ['membres', 'Trombi', 'users'],
  ['profil', 'Profil', 'user'],
]
// Onglet visible seulement par les coachs, placé avant « Profil »
const COACH_TABS = [...TABS.slice(0, 4), ['coachs', 'Coachs', 'shield'], TABS[4]]

export default function App() {
  const { ready, me, isAdmin, toast, recovery, pending } = useData()
  const [page, sub] = useRoute()

  const toastEl = toast && <div className={`toast ${toast.error ? 'err' : ''}`} role="status">{toast.text}</div>

  if (!ready) return <div className="splash"><Logo big /></div>
  if (me && recovery) return <><NewPassword />{toastEl}</>
  // Hors connexion ou compte en attente : seule la page « Tes données » est accessible
  if (!me || !isMember(me)) {
    if (page === 'confidentialite') {
      return (
        <div className="standalone">
          <header className="topbar"><Logo /></header>
          <main className="content"><Privacy standalone /></main>
          {toastEl}
        </div>
      )
    }
    return <>{me ? <Pending /> : <Login />}{toastEl}</>
  }

  let screen
  if ((page === 'courses' || page === 'resultats') && sub) screen = <RaceDetail id={sub} />
  else if (page === 'courses' || page === 'resultats') screen = <Races />
  else if (page === 'challenge') screen = <Challenge />
  else if (page === 'membres' && sub) screen = <MemberDetail id={sub} />
  else if (page === 'membres') screen = <Members />
  else if (page === 'profil') screen = <MemberDetail id={me.id} self />
  else if (page === 'coachs' && isAdmin) screen = <Coaches />
  else if (page === 'confidentialite') screen = <Privacy />
  else screen = <Sessions />

  return (
    <div className="shell">
      <header className="topbar">
        <Logo />
        <div className="topbar-right">
          {api.isDemo && <span className="tag-demo">Démo</span>}
          {isAdmin && <span className="tag-coach">Coach</span>}
          <a href="#/profil" aria-label="Mon profil"><Avatar p={me} size={34} /></a>
        </div>
      </header>

      <main className="content">{screen}</main>

      <nav className="tabbar" aria-label="Navigation principale">
        {(isAdmin ? COACH_TABS : TABS).map(([key, label, icon]) => (
          <a key={key} href={`#/${key}`} className={page === key || (key === 'courses' && page === 'resultats') ? 'on' : ''} aria-current={page === key ? 'page' : undefined}>
            <Icon name={icon} size={22} />
            <span>{label}</span>
            {key === 'coachs' && pending.length > 0 && <b className="tab-badge" aria-label={`${pending.length} à valider`}>{pending.length}</b>}
          </a>
        ))}
      </nav>

      {toastEl}
    </div>
  )
}
