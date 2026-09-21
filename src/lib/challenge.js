import { CHALLENGE } from '../config.js'
import { seasonOf } from './format.js'

// Classement du challenge pour une saison : km des courses terminées (+ bonus podium éventuel)
export function standings({ profiles, races, results, season }) {
  const raceById = Object.fromEntries(races.map((r) => [r.id, r]))
  const rows = {}
  for (const res of results) {
    const race = raceById[res.race_id]
    if (!race || seasonOf(race.race_date) !== season) continue
    if (res.time_seconds == null) continue // abandon : ne compte pas
    const row = (rows[res.member_id] ||= { member_id: res.member_id, km: 0, races: 0, podiums: 0, bonus: 0 })
    row.km += Number(race.distance_km)
    row.races += 1
    if (res.podium) {
      row.podiums += 1
      row.bonus += CHALLENGE.podiumBonusKm[res.podium] || 0
    }
  }
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]))
  return Object.values(rows)
    .filter((r) => byId[r.member_id])
    .map((r) => ({ ...r, total: r.km + r.bonus, profile: byId[r.member_id] }))
    .sort((a, b) => b.total - a.total || b.podiums - a.podiums || b.races - a.races)
    .reduce((acc, r, i) => {
      const prev = acc[i - 1]
      const tie = prev && prev.total === r.total && prev.podiums === r.podiums
      acc.push({ ...r, rank: tie ? prev.rank : i + 1 })
      return acc
    }, [])
}

export function seasonsFrom(races) {
  const set = new Set(races.map((r) => seasonOf(r.race_date)))
  set.add(seasonOf(new Date()))
  return [...set].sort().reverse()
}
