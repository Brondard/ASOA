import { api } from './api/index.js'
import Challenge from './screens/Challenge.jsx'
import Login, { NewPassword } from './screens/Login.jsx'
import Members, { MemberDetail } from './screens/Members.jsx'
import Races, { RaceDetail } from './screens/Races.jsx'
import Sessions from './screens/Sessions.jsx'
import { useData, useRoute } from './store.jsx'
import { Avatar, Icon, Logo } from './ui.jsx'

const TABS = [
  ['seances', 'Séances', 'calendar'],
  ['courses', 'Courses', 'medal'],
  ['challenge', 'Challenge', 'trophy'],
  ['membres', 'Trombi', 'users'],
  ['profil', 'Profil', 'user'],
]

export default function App() {
  const { ready, me, isAdmin, toast, recovery } = useData()
  const [page, sub] = useRoute()

  if (!ready) return <div className="splash"><Logo big /></div>
  if (me && recovery) return <><NewPassword />{toast && <div className={`toast ${toast.error ? 'err' : ''}`}>{toast.text}</div>}</>
  if (!me) return <><Login />{toast && <div className={`toast ${toast.error ? 'err' : ''}`}>{toast.text}</div>}</>

  let screen
  if ((page === 'courses' || page === 'resultats') && sub) screen = <RaceDetail id={sub} />
  else if (page === 'courses' || page === 'resultats') screen = <Races />
  else if (page === 'challenge') screen = <Challenge />
  else if (page === 'membres' && sub) screen = <MemberDetail id={sub} />
  else if (page === 'membres') screen = <Members />
  else if (page === 'profil') screen = <MemberDetail id={me.id} self />
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
        {TABS.map(([key, label, icon]) => (
          <a key={key} href={`#/${key}`} className={page === key || (key === 'courses' && page === 'resultats') ? 'on' : ''} aria-current={page === key ? 'page' : undefined}>
            <Icon name={icon} size={22} />
            <span>{label}</span>
          </a>
        ))}
      </nav>

      {toast && <div className={`toast ${toast.error ? 'err' : ''}`} role="status">{toast.text}</div>}
    </div>
  )
}
