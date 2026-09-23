import { useMemo, useState } from 'react'
import { CHALLENGE, DISCIPLINES } from '../config.js'
import { seasonsFrom, standings } from '../lib/challenge.js'
import { fullName, km, seasonOf } from '../lib/format.js'
import { go, useData } from '../store.jsx'
import { Avatar, Empty, PageHead } from '../ui.jsx'

export default function Challenge() {
  const { profiles, races, results, me } = useData()
  const [discipline, setDiscipline] = useState('all')
  const seasons = useMemo(() => seasonsFrom(races), [races])
  const current = seasonOf(new Date())
  // En tout début de saison, on ouvre sur la saison écoulée si la nouvelle est encore vide
  const [season, setSeason] = useState(() => {
    const hasCurrent = standings({ profiles, races, results, season: current }).length >= 3
    return hasCurrent ? current : seasons.find((s) => s !== current) || current
  })
  const rows = useMemo(() => standings({ profiles, races, results, season, discipline }), [profiles, races, results, season, discipline])
  const mine = rows.find((r) => r.member_id === me.id)
  const hasBonus = Object.values(CHALLENGE.podiumBonusKm).some(Boolean)
  const top = rows.slice(0, 3)

  return (
    <>
      <PageHead kicker="Challenge club" title={discipline === 'all' ? 'Kilomètres en course' : `Classement ${DISCIPLINES[discipline].label.toLowerCase()}`} />
      <div className="segmented" role="tablist">
        {[['all', 'Tout'], ...Object.entries(DISCIPLINES).map(([k, v]) => [k, v.short])].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={discipline === k} className={discipline === k ? 'on' : ''} onClick={() => setDiscipline(k)}>{label}</button>
        ))}
      </div>
      <div className="season-picker">
        <label htmlFor="season">Saison</label>
        <select id="season" value={season} onChange={(e) => setSeason(e.target.value)}>
          {seasons.map((s) => <option key={s} value={s}>{s}{s === current ? ' (en cours)' : ''}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <Empty>{discipline === 'all'
          ? 'Pas encore de kilomètres cette saison. Premier dossard, premiers points !'
          : `Aucune course ${DISCIPLINES[discipline].label.toLowerCase()} cette saison.`}</Empty>
      ) : (
        <>
          <ol className="podium" aria-label="Podium du challenge">
            {[top[1], top[0], top[2]].map((r, i) => r && (
              <li key={r.member_id} className={`step step-${[2, 1, 3][i]}`} onClick={() => go(`membres/${r.member_id}`)}>
                <Avatar p={r.profile} size={[52, 64, 52][i]} />
                <span className="step-name">{r.profile.first_name}</span>
                <span className="step-km">{km(r.total)}<small> km</small></span>
                <span className="step-block">{r.rank}</span>
              </li>
            ))}
          </ol>

          {mine && (
            <p className="me-line">
              Tu es <strong>{mine.rank}{mine.rank === 1 ? 'er' : 'e'}</strong> sur {rows.length} avec <strong>{km(mine.total)} km</strong>
              {mine.rank > 1 && <> — {km(rows[mine.rank - 2].total - mine.total)} km derrière {rows[mine.rank - 2].profile.first_name}</>}.
            </p>
          )}

          <div className="table-wrap">
            <table className="results standings">
              <thead><tr><th className="c-pos">#</th><th>Adhérent</th><th className="c-num">Km</th><th className="c-num hide-sm">Courses</th><th className="c-num">Podiums</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.member_id} className={r.member_id === me.id ? 'me' : ''} onClick={() => go(`membres/${r.member_id}`)}>
                    <td className="c-pos">{r.rank}</td>
                    <td><span className="who"><Avatar p={r.profile} size={30} /><span>{fullName(r.profile)}</span></span></td>
                    <td className="c-num strong">{km(r.total)}</td>
                    <td className="c-num hide-sm">{r.races}</td>
                    <td className="c-num">{r.podiums || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="hint">
        Règle : chaque course terminée rapporte sa distance en km (triathlon = nage + vélo + course). Les abandons ne comptent pas.
        {discipline !== 'all' && ' Ici, seules les courses de la discipline choisie comptent.'}
        {hasBonus ? ' Les podiums catégorie donnent un bonus.' : ' À égalité, le nombre de podiums départage.'} Saison du 1er septembre au 31 août.
      </p>
    </>
  )
}
