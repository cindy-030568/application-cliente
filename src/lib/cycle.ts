/**
 * Cycle et périménopause (logique pure, testée). Facultatif, choisi par la cliente.
 * - Cycle : le jour et la phase sont déduits des jours « règles » cochés dans son journal
 *   et de la durée habituelle de son cycle. Ce sont des repères indicatifs, jamais un avis médical.
 * - Périménopause : symptômes cochés chaque jour (liste fermée, identique à la base 0034).
 */
import { ajouterJours, joursEntre } from "./bilan";

export type ModeCycle = "aucun" | "cycle" | "perimenopause";
export const MODES_CYCLE: ModeCycle[] = ["aucun", "cycle", "perimenopause"];

export const SYMPTOMES = [
  { code: "bouffees", libelle: "Bouffées de chaleur" },
  { code: "sueurs", libelle: "Sueurs nocturnes" },
  { code: "sommeil", libelle: "Sommeil perturbé" },
  { code: "humeur", libelle: "Sautes d’humeur" },
  { code: "fatigue", libelle: "Fatigue" },
  { code: "regles_irregulieres", libelle: "Règles irrégulières" },
  { code: "articulations", libelle: "Douleurs articulaires" },
  { code: "ballonnements", libelle: "Ballonnements" },
  { code: "maux_tete", libelle: "Maux de tête" },
] as const;
export type CodeSymptome = (typeof SYMPTOMES)[number]["code"];
export const CODES_SYMPTOMES = SYMPTOMES.map((s) => s.code) as readonly string[];
export const libelleSymptome = (code: string) => SYMPTOMES.find((s) => s.code === code)?.libelle ?? code;

export type Phase = "regles" | "folliculaire" | "ovulation" | "luteale";
export const LIBELLE_PHASE: Record<Phase, string> = {
  regles: "règles",
  folliculaire: "phase folliculaire",
  ovulation: "période d’ovulation",
  luteale: "phase lutéale",
};

/** Avertissement affiché avec tout repère de cycle. */
export const PAS_UN_AVIS_MEDICAL = "Repères indicatifs, qui ne remplacent pas l’avis d’un professionnel de santé.";

/** Premiers jours de chaque cycle : un jour de règles après au moins 7 jours sans. */
export function debutsDeCycle(joursRegles: string[]): string[] {
  const jours = [...new Set(joursRegles)].sort();
  return jours.filter((j, i) => i === 0 || joursEntre(jours[i - 1], j) > 7);
}

export type SituationCycle = { jour: number; phase: Phase; retention: boolean; debut: string };

/**
 * Où en est le cycle ce jour-là. null si aucun début de cycle connu, ou si le dernier
 * remonte à trop longtemps (plus de la durée habituelle + 14 jours : cycle irrégulier, on ne devine pas).
 * Rétention d'eau fréquente : les 7 derniers jours avant les règles et les 3 premiers jours des règles.
 */
export function situationCycle(joursRegles: string[], jour: string, duree = 28): SituationCycle | null {
  const debut = debutsDeCycle(joursRegles.filter((j) => j <= jour)).at(-1);
  if (!debut) return null;
  const n = joursEntre(debut, jour) + 1;
  if (n > duree + 14) return null;
  const ovulation = duree - 14;
  const phase: Phase = n <= 5 ? "regles" : n < ovulation - 1 ? "folliculaire" : n <= ovulation + 1 ? "ovulation" : "luteale";
  const retention = n <= 3 || n >= duree - 6;
  return { jour: n, phase, retention, debut };
}

/** Prochaines règles attendues (indicatif). */
export const prochainesRegles = (s: SituationCycle, duree = 28) => ajouterJours(s.debut, duree);

/**
 * Message doux si le poids du jour monte alors qu'on est dans une phase de rétention :
 * comparé à la moyenne des pesées des 7 jours d'avant. Rien en mode sans chiffres.
 */
export function messageRetention(o: {
  mode: ModeCycle;
  sansChiffres: boolean;
  jour: string;
  poidsDuJour: number | null;
  pesees: { jour: string; poids: number | null }[];
  joursRegles: string[];
  duree: number;
}): string | null {
  if (o.mode !== "cycle" || o.sansChiffres || o.poidsDuJour === null) return null;
  const s = situationCycle(o.joursRegles, o.jour, o.duree);
  if (!s?.retention) return null;
  const avant = o.pesees
    .filter((p) => p.poids !== null && p.jour < o.jour && joursEntre(p.jour, o.jour) <= 7)
    .map((p) => p.poids as number);
  if (!avant.length) return null;
  const moyenne = avant.reduce((a, b) => a + b, 0) / avant.length;
  if (o.poidsDuJour - moyenne < 0.3) return null;
  return s.phase === "regles"
    ? "Le chiffre monte un peu ? C’est normal en ce moment : pendant les premiers jours des règles, le corps retient souvent de l’eau. Regarde la tendance sur plusieurs semaines plutôt que le chiffre du jour 💛"
    : "Le chiffre monte un peu ? C’est normal en ce moment : avant les règles, le corps retient souvent de l’eau. Regarde la tendance sur plusieurs semaines plutôt que le chiffre du jour 💛";
}

/** Symptômes reçus d'un formulaire : seulement ceux de la liste, sans doublon. */
export function lireSymptomes(valeurs: unknown[]): CodeSymptome[] {
  return [...new Set(valeurs.map(String).filter((v): v is CodeSymptome => CODES_SYMPTOMES.includes(v)))];
}
