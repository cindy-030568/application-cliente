/**
 * Journal quotidien : calculs du tableau de suivi (fonctions pures, testées).
 * Semaine 1 = les 7 jours à partir du démarrage. Moyennes par semaine (trainings : total),
 * écart mois par mois (semaine 4, 8, 12… comparée à la semaine 1) et synthèse globale.
 */
import { ajouterJours, joursEntre } from "@/lib/bilan";

export type EntreeJournal = {
  jour: string;
  poids: number | null;
  tour_taille: number | null;
  sommeil: number | null;
  hydratation: number | null;
  pas: number | null;
  trainings: number | null;
  stress: number | null;
  digestion: number | null;
  regles: boolean;
  observations: string | null;
};

export const INDICATEURS = [
  { cle: "poids", libelle: "Poids", unite: "kg", decimales: 1 },
  { cle: "tour_taille", libelle: "Tour de taille", unite: "cm", decimales: 1 },
  { cle: "sommeil", libelle: "Sommeil", unite: "h", decimales: 1 },
  { cle: "hydratation", libelle: "Hydratation", unite: "L", decimales: 1 },
  { cle: "pas", libelle: "Pas (NEAT)", unite: "", decimales: 0 },
  { cle: "trainings", libelle: "Trainings", unite: "", decimales: 0 },
  { cle: "stress", libelle: "Stress", unite: "/5", decimales: 1 },
  { cle: "digestion", libelle: "Digestion", unite: "/5", decimales: 1 },
] as const;
export type CleIndicateur = (typeof INDICATEURS)[number]["cle"];
const MOYENNES: CleIndicateur[] = ["poids", "tour_taille", "sommeil", "hydratation", "pas", "stress", "digestion"];

export type Semaine = {
  numero: number;
  debut: string;
  fin: string;
  jours: (EntreeJournal | null)[];
  /** Moyennes de la semaine ; « trainings » est le total. */
  valeurs: Record<CleIndicateur, number | null>;
  joursRegles: number;
  joursRemplis: number;
};

const moyenne = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const arrondi = (x: number | null, d = 2) => (x === null ? null : Math.round(x * 10 ** d) / 10 ** d);

export function numeroSemaine(debut: string, jour: string) {
  return Math.floor(joursEntre(debut, jour) / 7) + 1;
}

/** Semaines de la 1re jusqu'à celle d'aujourd'hui (ou de la dernière saisie), de la plus récente à la plus ancienne. */
export function semainesJournal(entrees: EntreeJournal[], debut: string, aujourdhui: string): Semaine[] {
  const parJour = new Map(entrees.map((e) => [e.jour, e]));
  const derniere = entrees.reduce((m, e) => (e.jour > m ? e.jour : m), aujourdhui);
  const nb = Math.max(1, numeroSemaine(debut, derniere < debut ? debut : derniere));
  const semaines: Semaine[] = [];
  for (let n = 1; n <= nb; n++) {
    const d = ajouterJours(debut, (n - 1) * 7);
    const jours = Array.from({ length: 7 }, (_, i) => parJour.get(ajouterJours(d, i)) ?? null);
    const remplis = jours.filter((j): j is EntreeJournal => j !== null);
    const valeurs = {} as Record<CleIndicateur, number | null>;
    for (const cle of MOYENNES) valeurs[cle] = arrondi(moyenne(remplis.map((j) => j[cle]).filter((x): x is number => x !== null)));
    const t = remplis.map((j) => j.trainings).filter((x): x is number => x !== null);
    valeurs.trainings = t.length ? t.reduce((s, x) => s + x, 0) : null;
    semaines.push({
      numero: n,
      debut: d,
      fin: ajouterJours(d, 6),
      jours,
      valeurs,
      joursRegles: remplis.filter((j) => j.regles).length,
      joursRemplis: remplis.length,
    });
  }
  return semaines.reverse();
}

/** Écart du poids et du tour de taille, mois par mois (semaine 4k comparée à la semaine 1). */
export function ecartsMensuels(semaines: Semaine[]) {
  const parNumero = new Map(semaines.map((s) => [s.numero, s]));
  const s1 = parNumero.get(1)?.valeurs;
  const mois: { mois: number; poids: number | null; tour_taille: number | null }[] = [];
  for (let m = 1; parNumero.has(m * 4); m++) {
    const s = parNumero.get(m * 4)!.valeurs;
    const ecart = (cle: "poids" | "tour_taille") => (s1?.[cle] != null && s[cle] != null ? arrondi(s[cle]! - s1[cle]!, 1) : null);
    mois.push({ mois: m, poids: ecart("poids"), tour_taille: ecart("tour_taille") });
  }
  return mois;
}

/** Synthèse globale, comme dans le tableau : départ (S1), actuel (dernière semaine renseignée), moyennes des semaines. */
export function syntheseJournal(semaines: Semaine[]) {
  const chrono = [...semaines].sort((a, b) => a.numero - b.numero);
  const s1 = chrono.find((s) => s.numero === 1)?.valeurs;
  const actuel = (cle: "poids" | "tour_taille") => [...chrono].reverse().find((s) => s.valeurs[cle] !== null)?.valeurs[cle] ?? null;
  const moyenneSemaines = (cle: CleIndicateur) =>
    arrondi(moyenne(chrono.map((s) => s.valeurs[cle]).filter((x): x is number => x !== null)), 1);
  const poidsDepart = s1?.poids ?? null;
  const tailleDepart = s1?.tour_taille ?? null;
  const poidsActuel = actuel("poids");
  const tailleActuelle = actuel("tour_taille");
  return {
    poidsDepart,
    poidsActuel,
    variationPoids: poidsDepart !== null && poidsActuel !== null ? arrondi(poidsActuel - poidsDepart, 1) : null,
    tailleDepart,
    tailleActuelle,
    variationTaille: tailleDepart !== null && tailleActuelle !== null ? arrondi(tailleActuelle - tailleDepart, 1) : null,
    sommeil: moyenneSemaines("sommeil"),
    hydratation: moyenneSemaines("hydratation"),
    pas: arrondi(moyenneSemaines("pas"), 0),
    trainingsParSemaine: moyenneSemaines("trainings"),
    totalTrainings: chrono.reduce((s, x) => s + (x.valeurs.trainings ?? 0), 0),
    stress: moyenneSemaines("stress"),
    digestion: moyenneSemaines("digestion"),
  };
}

/** « 7,5 », « 7h30 », « 7:30 » → 7,5 heures. */
export function lireHeures(brut: string): number | null {
  const v = brut.trim().toLowerCase().replace(/\s/g, "");
  if (!v) return null;
  const m = /^(\d{1,2})(?:h|:)(\d{1,2})?$/.exec(v);
  if (m) return Number(m[1]) + Number(m[2] ?? 0) / 60;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

/** Nombre tapé à la française (« 61,4 », « 8 500 ») ; null si vide, NaN si illisible. */
export function lireNombre(brut: string): number | null {
  const v = brut.replace(/[\s ]/g, "").replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/** Repère visuel (comme les couleurs du tableau) : « bon », « moyen » ou « faible ». */
export function tonValeur(cle: CleIndicateur, v: number | null): "bon" | "moyen" | "faible" | null {
  if (v === null) return null;
  switch (cle) {
    case "sommeil":
      return v >= 7 ? "bon" : v >= 6 ? "moyen" : "faible";
    case "hydratation":
      return v >= 1.8 ? "bon" : v >= 1.3 ? "moyen" : "faible";
    case "pas":
      return v >= 8000 ? "bon" : v >= 5000 ? "moyen" : "faible";
    case "stress":
      return v <= 2 ? "bon" : v < 4 ? "moyen" : "faible";
    case "digestion":
      return v >= 4 ? "bon" : v > 2 ? "moyen" : "faible";
    default:
      return null;
  }
}
