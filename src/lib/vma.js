// VMA : vitesse maximale aérobie, en km/h. Sert à calculer les allures d'entraînement.

export const fmtVma = (v) => (v ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v)} km/h` : null)

// Allure en min/km à un pourcentage de VMA : 100 % de 16 km/h -> 3'45/km
export const paceAt = (vma, pct = 100) => {
  if (!vma) return null
  const sec = 3600 / (vma * (pct / 100))
  return `${Math.floor(sec / 60)}'${String(Math.round(sec % 60)).padStart(2, '0')}`
}

// Allures repères d'une séance
export const VMA_ZONES = [
  { pct: 100, label: '100 % — 400 m' },
  { pct: 95, label: '95 % — 1000 m' },
  { pct: 90, label: '90 % — seuil' },
  { pct: 75, label: '75 % — endurance' },
]
