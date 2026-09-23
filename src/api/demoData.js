// Données d'exemple pour le mode démo (aucune base branchée).
// Noms fictifs — rien de tout ça n'est un vrai résultat.

let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const uid = (p, i) => `${p}-${String(i).padStart(3, '0')}`

const NAMES = [
  ['Marc', 'Rossi'], ['Julie', 'Martin'], ['Sofiane', 'Benali'], ['Claire', 'Giordano'], ['Lucas', 'Fabre'],
  ['Emma', 'Lambert'], ['Thierry', 'Pastorelli'], ['Nadia', 'Chérif'], ['Hugo', 'Bertrand'], ['Laura', 'Carlier'],
  ['Patrick', 'Musso'], ['Inès', 'Morel'], ['Romain', 'Guidi'], ['Camille', 'Arnaud'], ['Yann', 'Le Gall'],
  ['Sophie', 'Barelli'], ['Antoine', 'Roux'], ['Léa', 'Fontaine'], ['Karim', 'Haddad'], ['Mathilde', 'Pellegrino'],
  ['Olivier', 'Dumas'], ['Chloé', 'Vidal'], ['Stéphane', 'Ricci'], ['Manon', 'Lefèvre'], ['Julien', 'Castelli'],
  ['Aurélie', 'Blanc'], ['Nicolas', 'Ferrero'], ['Pauline', 'Garnier'],
]
const CITIES = ['Antibes', 'Antibes', 'Juan-les-Pins', 'Biot', 'Vallauris', 'Valbonne', 'Villeneuve-Loubet', 'Cagnes-sur-Mer']
const DISC_SETS = [['running'], ['running', 'trail'], ['triathlon'], ['triathlon', 'running'], ['trail'], ['running', 'trail', 'triathlon']]

export function buildDemo() {
  seed = 7
  const profiles = NAMES.map(([first_name, last_name], i) => ({
    id: uid('m', i),
    first_name,
    last_name,
    avatar_url: null,
    city: pick(CITIES),
    disciplines: i === 0 ? ['running', 'trail', 'triathlon'] : pick(DISC_SETS),
    is_admin: i === 0,
    level: 0.82 + rnd() * 0.45, // 1 = niveau moyen, plus petit = plus rapide
  }))

  // --- Courses ---------------------------------------------------------
  const races = [
    ['Triathlon de Cap d\'Ail', '2025-09-21', 'Cap d\'Ail', 'triathlon', 'Distance S', 25.75, 205],
    ['10 km d\'Antibes', '2025-10-12', 'Antibes', 'running', '10 km', 10, 290],
    ['Marathon Nice-Cannes', '2025-11-09', 'Nice → Cannes', 'running', 'Marathon', 42.2, 325],
    ['Trail de la Valmasque', '2026-01-25', 'Valbonne', 'trail', '18 km · 550 D+', 18, 420],
    ['Trail des Balcons d\'Azur', '2026-03-22', 'Mandelieu', 'trail', '45 km · 2300 D+', 45, 560],
    ['Triathlon de Cannes', '2026-04-12', 'Cannes', 'triathlon', 'Distance M', 51.5, 185],
    ['Semi-marathon de Nice', '2026-04-26', 'Nice', 'running', 'Semi-marathon', 21.1, 300],
    ['Ironman France', '2026-06-28', 'Nice', 'triathlon', 'Distance XXL', 226, 205],
    ['10 km de Juan-les-Pins', '2026-09-06', 'Juan-les-Pins', 'running', '10 km', 10, 290],
    ['Triathlon de Cap d\'Ail', '2026-09-20', 'Cap d\'Ail', 'triathlon', 'Distance S', 25.75, 205],
  ].map(([name, race_date, location, discipline, format, distance_km, basePace], i) => ({
    id: uid('r', i), name, race_date, location, discipline, format, distance_km, _pace: basePace,
  }))

  // --- Résultats ---------------------------------------------------------
  const results = []
  let n = 0
  for (const race of races) {
    const eligible = profiles.filter((p) => p.disciplines.includes(race.discipline) || rnd() < 0.12)
    const count = race.distance_km > 100 ? 4 : Math.min(eligible.length, 5 + Math.floor(rnd() * 8))
    const runners = [...eligible].sort(() => rnd() - 0.5).slice(0, count)
    const finishers = Math.round(race.distance_km > 100 ? 2400 : 300 + rnd() * 1400)
    const raw = runners.map((p) => ({
      p,
      t: Math.round(race.distance_km * race._pace * p.level * (0.95 + rnd() * 0.1)),
      dnf: race.distance_km >= 40 && rnd() < 0.1,
    }))
    const fastest = Math.min(...raw.map((x) => x.t))
    for (const { p, t, dnf } of raw) {
      const rel = (t - fastest * 0.78) / (fastest * 0.9)
      const rank = Math.max(1, Math.min(finishers, Math.round(rel * finishers * 0.8 + rnd() * 40)))
      results.push({
        id: uid('x', n++),
        race_id: race.id,
        member_id: p.id,
        time_seconds: dnf ? null : t,
        rank_overall: dnf ? null : rank,
        finishers,
        podium: !dnf && rank < finishers * 0.08 && rnd() < 0.5 ? 1 + Math.floor(rnd() * 3) : null,
        note: null,
      })
    }
    delete race._pace
  }
  profiles.forEach((p) => delete p.level)

  // --- Courses à venir + inscriptions -------------------------------------
  const upcoming = [
    ['Trail des Balcons d\'Azur', '2027-03-21', 'Mandelieu', 'trail', '28 km · 1300 D+', 28, false, null],
    ['Triathlon de Cannes', '2027-04-11', 'Cannes', 'triathlon', 'Distance M', 51.5, false, null],
    ['Semi-marathon de Nice', '2027-04-25', 'Nice', 'running', 'Semi-marathon', 21.1, false, null],
  ].map(([name, race_date, location, discipline, format, distance_km, is_club_goal, description], i) => ({
    id: uid('f', i), name, race_date, location, discipline, format, distance_km, is_club_goal, description,
    registration_url: is_club_goal ? 'https://www.example.org/inscription' : null,
  }))
  // Épreuve à plusieurs formats : une ligne « épreuve » + une ligne par format
  const bologne = {
    id: 'e-000', name: 'Marathon de Bologne', race_date: '2027-03-07', location: 'Bologne (Italie)', discipline: 'running',
    format: null, distance_km: 0, parent_id: null, is_club_goal: true,
    registration_url: 'https://www.example.org/inscription',
    description: 'Objectif club de la saison ! On vise 25 coureurs ASOA au départ, tous formats confondus.\nDéplacement en minibus le samedi matin, hébergement groupé réservé par le club (2 nuits). Plan d\'entraînement de 16 semaines à partir de novembre.',
  }
  const bologneFormats = [['Marathon', 42.2], ['30 km', 30], ['Semi-marathon', 21.1], ['10 km', 10]].map(([format, distance_km], i) => ({
    id: `e-00${i + 1}`, name: bologne.name, race_date: bologne.race_date, location: bologne.location, discipline: 'running',
    format, distance_km, parent_id: bologne.id, is_club_goal: true, description: null, registration_url: null,
  }))
  races.push(bologne, ...bologneFormats, ...upcoming)
  const registrations = []
  // Inscriptions réparties sur les 4 formats de Bologne
  const pool = [...profiles].sort(() => rnd() - 0.5)
  let pi = 0
  bologneFormats.forEach((fm, i) => {
    const n = [6, 3, 7, 4][i]
    for (let k = 0; k < n && pi < pool.length; k++, pi++) {
      registrations.push({ race_id: fm.id, member_id: pool[pi].id, status: k === n - 1 && i % 2 ? 'interested' : 'going' })
    }
  })
  if (!registrations.some((r) => r.member_id === 'm-001')) registrations.push({ race_id: bologneFormats[2].id, member_id: 'm-001', status: 'going' })
  upcoming.forEach((r, i) => {
    const n = r.is_club_goal ? 17 : 3 + i * 2
    ;[...profiles].sort(() => rnd() - 0.5).slice(0, n).forEach((p, j) => {
      if (p.id === 'm-001' && !r.is_club_goal) return
      registrations.push({ race_id: r.id, member_id: p.id, status: j % 4 === 3 ? 'interested' : 'going' })
    })
  })

  // Course terminée il y a 2 jours : inscrits mais temps pas encore saisis (démo de la saisie groupée)
  const past = new Date()
  past.setDate(past.getDate() - 2)
  const recent = {
    id: 'f-900', name: 'Trail du Baou', race_date: past.toLocaleDateString('sv-SE'), location: 'Saint-Jeannet',
    discipline: 'trail', format: '16 km · 800 D+', distance_km: 16, is_club_goal: false, description: null, registration_url: null,
  }
  races.push(recent)
  ;['m-000', 'm-001', 'm-004', 'm-009', 'm-013', 'm-017', 'm-021'].forEach((m, j) =>
    registrations.push({ race_id: recent.id, member_id: m, status: j === 6 ? 'interested' : 'going' }))

  // --- Séances des 3 prochaines semaines ---------------------------------
  const PLAN = [
    { dow: 2, h: 18, m: 30, discipline: 'running', place: 0, title: 'Fractionné piste', dur: 90,
      desc: ['Échauffement 20 min, 10 × 400 m récup 1 min, retour au calme.', 'Échauffement 20 min, 5 × 1000 m récup 2 min, retour au calme.', 'Pyramide 200-400-600-800-600-400-200, récup = moitié du temps d\'effort.'] },
    { dow: 3, h: 7, m: 0, discipline: 'triathlon', place: 1, title: 'Natation en mer', dur: 60,
      desc: ['1,5 km entre les bouées. Combinaison conseillée, bonnet de couleur obligatoire.', 'Travail des départs et contournements de bouées, 3 × 500 m.', 'Sortie longue 2,5 km, nage en groupe.'] },
    { dow: 4, h: 18, m: 45, discipline: 'running', place: 3, title: 'Footing + gammes', dur: 60,
      desc: ['45 min en endurance fondamentale le long des remparts, puis gammes et lignes droites.', '50 min tranquille jusqu\'au Fort Carré, 6 lignes droites.', '40 min + renforcement gainage sur la plage.'] },
    { dow: 6, h: 8, m: 0, discipline: 'triathlon', place: 3, title: 'Sortie vélo', dur: 180,
      desc: ['70 km vers Gourdon, 900 m D+. Regroupement au sommet. Casque obligatoire.', '60 km vallonnés par Biot et Valbonne, allure groupe.', '85 km par le col de Vence, deux groupes de niveau.'] },
    { dow: 0, h: 8, m: 30, discipline: 'trail', place: 2, title: 'Sortie trail', dur: 120,
      desc: ['15 km et 400 m D+ dans la Valmasque. Frontale inutile, eau obligatoire.', 'Côtes : 8 × montée de 2 min, descente technique en récup.', '20 km vallonnés, allure conversation.'] },
  ]
  const PLACES = [
    { name: 'Stade du Fort Carré', address: 'Avenue du 11 Novembre, 06600 Antibes', lat: 43.5876, lng: 7.1263 },
    { name: 'Plage de la Salis', address: 'Boulevard James Wyllie, 06160 Antibes', lat: 43.5723, lng: 7.1281 },
    { name: 'Parc de la Valmasque', address: 'Route de Valbonne, 06410 Biot', lat: 43.6139, lng: 7.0677 },
    { name: 'Port Vauban', address: 'Avenue de Verdun, 06600 Antibes', lat: 43.5864, lng: 7.1265 },
  ]
  const sessions = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let k = 0
  for (let d = 0; d < 21; d++) {
    const day = new Date(today)
    day.setDate(today.getDate() + d)
    for (const s of PLAN.filter((p) => p.dow === day.getDay())) {
      const start = new Date(day)
      start.setHours(s.h, s.m)
      const pl = PLACES[s.place]
      sessions.push({
        id: uid('s', k++),
        starts_at: start.toISOString(),
        duration_min: s.dur,
        discipline: s.discipline,
        title: s.title,
        description: s.desc[Math.floor(d / 7) % s.desc.length],
        location_name: pl.name,
        address: pl.address,
        lat: pl.lat,
        lng: pl.lng,
        min_participants: s.discipline === 'triathlon' ? 4 : null,
        cancelled: false,
      })
    }
  }

  // --- Présences : réponses déjà données sur les séances -------------------
  const attendance = []
  sessions.forEach((s, i) => {
    const n = Math.floor(rnd() * 14) + (s.title === 'Natation en mer' ? 1 : 3)
    ;[...profiles].sort(() => rnd() - 0.5).slice(0, n).forEach((p) => {
      if (p.id === 'm-001' && i % 3) return
      attendance.push({ session_id: s.id, member_id: p.id, status: rnd() < 0.8 ? 'yes' : 'maybe' })
    })
  })
  // Séances passées (pour le badge d'assiduité de la démo)
  for (let w = 1; w <= 14; w++) {
    const d = new Date(today)
    d.setDate(d.getDate() - w * 7 + 1)
    d.setHours(18, 30)
    const id = uid('p', w)
    sessions.push({ id, starts_at: d.toISOString(), duration_min: 90, discipline: 'running', title: 'Fractionné piste',
      description: 'Séance passée.', location_name: PLACES[0].name, address: PLACES[0].address, lat: PLACES[0].lat, lng: PLACES[0].lng,
      min_participants: null, cancelled: false })
    ;['m-001', 'm-000', 'm-004', 'm-008', 'm-012'].forEach((m) => attendance.push({ session_id: id, member_id: m, status: 'yes' }))
  }

  return { profiles, races, results, sessions, attendance, registrations }
}
