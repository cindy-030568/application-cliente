/**
 * « Mon métabolisme » (espace abonnées) : logique pure, testée.
 * Métabolisme de base : formule de Mifflin-St Jeor (femme) = 10 × poids + 6,25 × taille − 5 × âge − 161.
 * Besoins du quotidien : métabolisme de base × niveau d'activité.
 * C'est un repère, jamais un objectif à atteindre ni un compteur.
 */

export type Activite = "sedentaire" | "legere" | "moderee" | "active" | "tres_active";

export const ACTIVITES: { code: Activite; libelle: string; detail: string; facteur: number }[] = [
  { code: "sedentaire", libelle: "Plutôt assise", detail: "Travail de bureau, peu de marche, pas de sport.", facteur: 1.2 },
  { code: "legere", libelle: "Un peu active", detail: "Tu marches un peu chaque jour, ou 1 à 2 séances par semaine.", facteur: 1.375 },
  { code: "moderee", libelle: "Active", detail: "3 à 4 séances par semaine, ou un métier où tu bouges.", facteur: 1.55 },
  { code: "active", libelle: "Très active", detail: "5 séances ou plus par semaine, ou un métier physique.", facteur: 1.725 },
  { code: "tres_active", libelle: "Sportive intensive", detail: "Entraînements quotidiens et intenses, ou deux par jour.", facteur: 1.9 },
];

export type DonneesMetabolisme = { annee_naissance: number; taille_cm: number; poids_kg: number; activite: Activite };

export const ageEn = (annee: number, anneeActuelle: number) => anneeActuelle - annee;

/** Métabolisme de base (kcal / jour), arrondi à la dizaine. */
export function metabolismeDeBase(d: DonneesMetabolisme, anneeActuelle: number): number {
  const brut = 10 * d.poids_kg + 6.25 * d.taille_cm - 5 * ageEn(d.annee_naissance, anneeActuelle) - 161;
  return Math.round(brut / 10) * 10;
}

/** Besoins du quotidien (kcal / jour) selon l'activité, arrondis à la cinquantaine. */
export function besoinsQuotidiens(d: DonneesMetabolisme, anneeActuelle: number): number {
  const f = ACTIVITES.find((a) => a.code === d.activite)?.facteur ?? 1.2;
  return Math.round((metabolismeDeBase(d, anneeActuelle) * f) / 50) * 50;
}

/** Lit et vérifie le formulaire. */
export function lireFormulaireMetabolisme(
  f: { annee_naissance?: string; taille_cm?: string; poids_kg?: string; activite?: string },
  anneeActuelle: number,
): { valeurs: DonneesMetabolisme; erreur?: undefined } | { valeurs?: undefined; erreur: string } {
  const nombre = (v?: string) => Number(String(v ?? "").replace(",", ".").replace(/\s/g, ""));
  const annee = nombre(f.annee_naissance);
  const taille = nombre(f.taille_cm);
  const poids = nombre(f.poids_kg);
  if (!Number.isInteger(annee) || annee < 1920 || anneeActuelle - annee < 16) return { erreur: "Indique ton année de naissance (par exemple 1988)." };
  if (!(taille >= 120 && taille <= 220)) return { erreur: "Indique ta taille en centimètres (par exemple 165)." };
  if (!(poids >= 30 && poids <= 250)) return { erreur: "Indique ton poids en kilos (par exemple 64,5)." };
  const activite = ACTIVITES.find((a) => a.code === f.activite)?.code;
  if (!activite) return { erreur: "Choisis ton niveau d’activité." };
  return { valeurs: { annee_naissance: annee, taille_cm: Math.round(taille * 10) / 10, poids_kg: Math.round(poids * 10) / 10, activite } };
}

export const formaterKcal = (n: number) => `${n.toLocaleString("fr-FR")} kcal`;
