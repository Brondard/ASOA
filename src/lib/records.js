// Records perso sur les distances route classiques.
// Une course compte pour une distance si sa distance tombe dans la fourchette.
export const RECORD_DISTANCES = [
  { key: '5k', label: '5 km', min: 4.9, max: 5.1 },
  { key: '10k', label: '10 km', min: 9.8, max: 10.2 },
  { key: 'semi', label: 'Semi', min: 21.0, max: 21.3 },
  { key: 'marathon', label: 'Marathon', min: 42.0, max: 42.4 },
]

export const distanceKey = (race) =>
  race?.discipline === 'running'
    ? RECORD_DISTANCES.find((d) => race.distance_km >= d.min && race.distance_km <= d.max)?.key
    : undefined

// Performances terminées d'un adhérent, rangées par date
function finished(memberId, results, raceById) {
  return results
    .filter((r) => r.member_id === memberId && r.time_seconds && raceById[r.race_id])
    .map((r) => ({ ...r, race: raceById[r.race_id] }))
    .sort((a, b) => a.race.race_date.localeCompare(b.race.race_date))
}

// Meilleur temps par distance : { '10k': { time_seconds, race, ... } }
export function personalRecords(memberId, results, races) {
  const raceById = Object.fromEntries(races.map((r) => [r.id, r]))
  const best = {}
  for (const r of finished(memberId, results, raceById)) {
    const k = distanceKey(r.race)
    if (k && (!best[k] || r.time_seconds < best[k].time_seconds)) best[k] = r
  }
  return best
}

// Ids des résultats qui ont battu un record perso existant (pas la 1re fois sur la distance)
export function recordBreakers(results, races) {
  const raceById = Object.fromEntries(races.map((r) => [r.id, r]))
  const sorted = results
    .filter((r) => r.time_seconds && raceById[r.race_id])
    .sort((a, b) => raceById[a.race_id].race_date.localeCompare(raceById[b.race_id].race_date))
  const best = {}
  const out = new Set()
  for (const r of sorted) {
    const k = distanceKey(raceById[r.race_id])
    if (!k) continue
    const id = `${r.member_id}:${k}`
    if (best[id] != null && r.time_seconds < best[id]) out.add(r.id)
    if (best[id] == null || r.time_seconds < best[id]) best[id] = r.time_seconds
  }
  return out
}
