// ---------------------------------------------------------------
//  Réglages du club — tout ce qui se modifie sans toucher au reste
// ---------------------------------------------------------------

export const CLUB = {
  shortName: 'ASOA',
  fullName: 'ASOA Antibes',
  city: 'Antibes',
}

export const DISCIPLINES = {
  running:   { label: 'Course à pied', short: 'Route' },
  trail:     { label: 'Trail',         short: 'Trail' },
  triathlon: { label: 'Triathlon',     short: 'Tri' },
}

// Challenge club : on additionne les km des courses terminées (avec un temps).
// Bonus podium (en km ajoutés) — mettre 0 pour ignorer les podiums dans le total.
export const CHALLENGE = {
  podiumBonusKm: { 1: 0, 2: 0, 3: 0 },
  // La saison démarre le 1er septembre (mois 8 en JavaScript : janvier = 0)
  seasonStartMonth: 8,
}

// Lieux habituels proposés dans le formulaire de séance
export const USUAL_PLACES = [
  { name: 'Stade du Fort Carré', address: 'Avenue du 11 Novembre, 06600 Antibes' },
  { name: 'Plage de la Salis', address: 'Boulevard James Wyllie, 06160 Antibes' },
  { name: 'Parc de la Valmasque', address: 'Route de Valbonne, 06410 Biot' },
  { name: 'Port Vauban', address: 'Avenue de Verdun, 06600 Antibes' },
  { name: 'Sentier du littoral — Cap d\'Antibes', address: 'Chemin des Douaniers, 06160 Antibes' },
]
