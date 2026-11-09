const JOUR = 24 * 60 * 60 * 1000;

/** Convertit "AAAA-MM-JJ" en date UTC à minuit. */
export function versDate(iso: string): Date {
  const [a, m, j] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j));
}

export function versIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Prochaine date de bilan (aujourd'hui inclus), calée sur la date de début
 * et la fréquence en jours. Null si pas de date de début.
 */
export function prochainBilan(
  dateDebut: string | null,
  frequenceJours: number,
  aujourdhui: string,
): string | null {
  if (!dateDebut || frequenceJours < 1) return null;
  const debut = versDate(dateDebut).getTime();
  const auj = versDate(aujourdhui).getTime();
  if (auj <= debut) return versIso(new Date(debut + frequenceJours * JOUR));
  const ecoules = Math.floor((auj - debut) / JOUR);
  const n = Math.ceil(ecoules / frequenceJours);
  return versIso(new Date(debut + Math.max(n, 1) * frequenceJours * JOUR));
}

/** Nombre de jours entre deux dates ISO (b - a). */
export function joursEntre(a: string, b: string): number {
  return Math.round((versDate(b).getTime() - versDate(a).getTime()) / JOUR);
}

/** Date du jour à Paris, au format AAAA-MM-JJ. */
export function aujourdhuiParis(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function formaterDate(iso: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options,
  }).format(versDate(iso));
}
