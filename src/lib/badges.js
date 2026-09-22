import { recordBreakers } from './records.js'

// Chaque badge : un calcul qui renvoie la progression { value, goal }.
// Pour en ajouter un, il suffit d'ajouter une ligne ici.
export const BADGES = [
  { id: 'first', icon: '🏁', name: 'Premier dossard', desc: 'Terminer une première course', goal: 1, calc: (c) => c.finished.length },
  { id: 'r10', icon: '🔟', name: 'Habitué', desc: 'Terminer 10 courses', goal: 10, calc: (c) => c.finished.length },
  { id: 'r25', icon: '💪', name: 'Pilier du club', desc: 'Terminer 25 courses', goal: 25, calc: (c) => c.finished.length },
  { id: 'k100', icon: '💯', name: '100 km', desc: '100 km cumulés en course', goal: 100, calc: (c) => c.km },
  { id: 'k500', icon: '🚀', name: '500 km', desc: '500 km cumulés en course', goal: 500, calc: (c) => c.km },
  { id: 'podium', icon: '🥇', name: 'Sur la boîte', desc: 'Monter sur un podium de catégorie', goal: 1, calc: (c) => c.podiums },
  { id: 'pr', icon: '⚡', name: 'Record battu', desc: 'Battre un de ses records perso', goal: 1, calc: (c) => c.prs },
  { id: 'marathon', icon: '🏛️', name: 'Marathonien', desc: 'Terminer un marathon', goal: 1, calc: (c) => c.count((r) => r.discipline === 'running' && r.distance_km >= 42) },
  { id: 'trail', icon: '⛰️', name: 'Traileur', desc: 'Terminer un trail', goal: 1, calc: (c) => c.count((r) => r.discipline === 'trail') },
  { id: 'ultra', icon: '🦅', name: 'Ultra', desc: 'Terminer un trail de 42 km ou plus', goal: 1, calc: (c) => c.count((r) => r.discipline === 'trail' && r.distance_km >= 42) },
  { id: 'tri', icon: '🏊', name: 'Triathlète', desc: 'Terminer un triathlon', goal: 1, calc: (c) => c.count((r) => r.discipline === 'triathlon') },
  { id: 'iron', icon: '🔱', name: 'Iron', desc: 'Terminer un triathlon distance XXL', goal: 1, calc: (c) => c.count((r) => r.discipline === 'triathlon' && r.distance_km >= 200) },
  { id: 'all3', icon: '🎯', name: 'Couteau suisse', desc: 'Terminer une course de chaque discipline', goal: 3, calc: (c) => new Set(c.finished.map((r) => r.race.discipline)).size },
  { id: 'goal', icon: '🚌', name: 'Esprit club', desc: 'Participer à une course objectif club', goal: 1, calc: (c) => c.count((r) => r.is_club_goal) },
  { id: 's10', icon: '📅', name: 'Assidu', desc: 'Être inscrit à 10 séances', goal: 10, calc: (c) => c.sessions },
  { id: 's50', icon: '🔥', name: 'Inarrêtable', desc: 'Être inscrit à 50 séances', goal: 50, calc: (c) => c.sessions },
]

export function badgesFor(memberId, { results, races, attendance, sessions }) {
  const raceById = Object.fromEntries(races.map((r) => [r.id, r]))
  const finished = results
    .filter((r) => r.member_id === memberId && r.time_seconds && raceById[r.race_id])
    .map((r) => ({ ...r, race: raceById[r.race_id] }))
  const prSet = recordBreakers(results, races)
  const now = Date.now()
  const pastOk = new Set(sessions.filter((s) => !s.cancelled && new Date(s.starts_at) < now).map((s) => s.id))
  const ctx = {
    finished,
    km: finished.reduce((a, r) => a + Number(r.race.distance_km), 0),
    podiums: finished.filter((r) => r.podium).length,
    prs: finished.filter((r) => prSet.has(r.id)).length,
    sessions: attendance.filter((a) => a.member_id === memberId && a.status === 'yes' && pastOk.has(a.session_id)).length,
    count: (pred) => finished.filter((r) => pred(r.race)).length,
  }
  return BADGES.map((b) => {
    const value = b.calc(ctx)
    return { ...b, value: Math.min(value, b.goal), earned: value >= b.goal }
  })
}
