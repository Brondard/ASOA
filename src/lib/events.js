// Une « épreuve » (ex. Marathon de Bologne) peut regrouper plusieurs formats
// (10 km, semi, 30 km, marathon). Chaque format est une course rattachée par parent_id.

export const formatsOf = (races, race) =>
  races.filter((r) => r.parent_id === race.id).sort((a, b) => b.distance_km - a.distance_km)

export const isEvent = (races, race) => races.some((r) => r.parent_id === race.id)

// Les formats d'une épreuve, ou la course elle-même si elle n'en a qu'un
export const legsOf = (races, race) => {
  const f = formatsOf(races, race)
  return f.length ? f : [race]
}

export const eventOf = (races, race) => (race.parent_id ? races.find((r) => r.id === race.parent_id) : null)

// Courses qui portent des résultats : les formats, et les courses sans formats
export const leafRaces = (races) => races.filter((r) => r.parent_id || !isEvent(races, r))

// Épreuves et courses simples (rien qui soit un format d'une autre)
export const topRaces = (races) => races.filter((r) => !r.parent_id)

export const labelOf = (race) => race.format || `${race.distance_km} km`
