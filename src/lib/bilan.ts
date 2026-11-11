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

function ajouterJours(iso: string, jours: number): string {
  return versIso(new Date(versDate(iso).getTime() + jours * JOUR));
}

export type EtatEcheance = {
  /** L'échéance à laquelle un bilan envoyé aujourd'hui se rattache. */
  echeance: string;
  /** « ouverte » : dans la fenêtre avant l'échéance ; « en_retard » : échéance passée, encore rattrapable. */
  statut: "ouverte" | "en_retard";
  /** Dernier jour où ce bilan peut être envoyé pour cette échéance. */
  fermeLe: string;
};

/**
 * Échéance actuellement ouverte pour le bilan, ou null.
 * Le bilan s'ouvre `fenetre` jours avant l'échéance et reste rattrapable
 * jusqu'à la moitié de l'intervalle suivant.
 */
export function echeanceOuverte(
  dateDebut: string | null,
  frequence: number,
  fenetre: number,
  aujourdhui: string,
): EtatEcheance | null {
  if (!dateDebut || frequence < 1) return null;
  const tolerance = Math.floor(frequence / 2);
  const prochaine = prochainBilan(dateDebut, frequence, aujourdhui);
  if (!prochaine) return null;
  if (joursEntre(aujourdhui, prochaine) <= fenetre) {
    return { echeance: prochaine, statut: "ouverte", fermeLe: ajouterJours(prochaine, tolerance) };
  }
  const precedente = ajouterJours(prochaine, -frequence);
  if (precedente >= ajouterJours(dateDebut, frequence) && joursEntre(precedente, aujourdhui) <= tolerance) {
    return {
      echeance: precedente,
      statut: aujourdhui === precedente ? "ouverte" : "en_retard",
      fermeLe: ajouterJours(precedente, tolerance),
    };
  }
  return null;
}

/** Dernière échéance strictement passée (null si aucune n'est encore passée). */
export function derniereEcheancePassee(
  dateDebut: string | null,
  frequence: number,
  aujourdhui: string,
): string | null {
  if (!dateDebut || frequence < 1) return null;
  const prochaine = prochainBilan(dateDebut, frequence, aujourdhui);
  if (!prochaine) return null;
  const derniere = ajouterJours(prochaine, -frequence);
  return derniere >= ajouterJours(dateDebut, frequence) && derniere < aujourdhui ? derniere : null;
}

/** Les n dernières échéances passées, de la plus récente à la plus ancienne. */
export function echeancesPassees(
  dateDebut: string | null,
  frequence: number,
  aujourdhui: string,
  n: number,
): string[] {
  const resultat: string[] = [];
  let e = derniereEcheancePassee(dateDebut, frequence, aujourdhui);
  while (e && dateDebut && resultat.length < n && e >= ajouterJours(dateDebut, frequence)) {
    resultat.push(e);
    e = ajouterJours(e, -frequence);
  }
  return resultat;
}

export type Alerte =
  | { type: "bilan_manquant"; echeance: string; retard: number }
  | { type: "decrochage_bilans"; manques: number }
  | { type: "decrochage_visite"; jours: number | null }
  | { type: "fin_suivi"; dateFin: string; jours: number };

/** Alertes d'une cliente active, pour le tableau de bord de la coach. */
export function alertesCliente(
  c: {
    statut: string;
    date_debut: string | null;
    date_fin: string | null;
    frequence_bilan_jours: number;
    derniere_visite: string | null;
    created_at: string;
  },
  echeancesRecues: Set<string>,
  aujourdhui: string,
): Alerte[] {
  if (c.statut !== "active") return [];
  const alertes: Alerte[] = [];

  const passees = echeancesPassees(c.date_debut, c.frequence_bilan_jours, aujourdhui, 2);
  if (passees[0] && !echeancesRecues.has(passees[0])) {
    alertes.push({ type: "bilan_manquant", echeance: passees[0], retard: joursEntre(passees[0], aujourdhui) });
  }
  if (passees.length === 2 && passees.every((e) => !echeancesRecues.has(e))) {
    alertes.push({ type: "decrochage_bilans", manques: 2 });
  }

  const reference = c.derniere_visite ?? c.created_at;
  const joursSansVisite = joursEntre(reference.slice(0, 10), aujourdhui);
  if (joursSansVisite >= 10) {
    alertes.push({ type: "decrochage_visite", jours: c.derniere_visite ? joursSansVisite : null });
  }

  if (c.date_fin) {
    const jours = joursEntre(aujourdhui, c.date_fin);
    if (jours >= 0 && jours <= 15) alertes.push({ type: "fin_suivi", dateFin: c.date_fin, jours });
  }
  return alertes;
}

/** Vrai si la dernière visite date de plus d'une heure (ou n'existe pas). */
export function visiteANoter(derniereVisite: string | null, maintenant = Date.now()): boolean {
  return !derniereVisite || maintenant - Date.parse(derniereVisite) > 60 * 60 * 1000;
}

/** Rendez-vous encore à venir (ou commencé depuis moins de 2 h). */
export function rdvAVenir(rdv: string | null, maintenant = Date.now()): string | null {
  return rdv && Date.parse(rdv) > maintenant - 2 * 60 * 60 * 1000 ? rdv : null;
}

/** Décalage horaire de Paris (ex. « +01:00 ») à une date donnée. */
function decalageParis(date: Date): string {
  const nom = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = nom?.match(/GMT([+-]\d{2}):?(\d{2})?/);
  return m ? `${m[1]}:${m[2] ?? "00"}` : "+00:00";
}

/** « 2026-11-20T18:30 » (heure de Paris) → ISO UTC. Null si invalide. */
export function heureParisVersIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const approx = new Date(`${local}:00Z`);
  if (Number.isNaN(approx.getTime())) return null;
  const date = new Date(`${local}:00${decalageParis(approx)}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** ISO UTC → « 2026-11-20T18:30 » en heure de Paris (pour un champ datetime-local). */
export function isoVersHeureParis(iso: string | null): string {
  if (!iso) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
