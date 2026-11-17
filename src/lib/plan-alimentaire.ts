/**
 * Plan alimentaire (logique pure, partagée coach / cliente / PDF).
 * - calcul des besoins (métabolisme de base × niveau d'activité, répartition des macros) ;
 * - totaux par ligne, repas et journée ;
 * - alternatives « ou » : quantité équivalente calculée automatiquement.
 *
 * Le contenu d'un plan est un instantané : chaque aliment garde son nom et ses valeurs
 * pour 100 g, pour que le plan publié ne change pas si l'aliment est modifié ensuite.
 */
import { formaterQuantite, type Unite } from "./nutrition";

// ---------------------------------------------------------------- Besoins

export type Sexe = "femme" | "homme";
export type Formule = "black" | "mifflin" | "harris";

export const FORMULES: Record<Formule, string> = {
  black: "Formule de Black (1996)",
  mifflin: "Mifflin-St Jeor",
  harris: "Harris-Benedict révisée",
};

/** Niveaux d'activité physique (NAP), modifiables à la main. */
export const NIVEAUX_ACTIVITE = [
  { nap: 1.4, libelle: "Sédentaire" },
  { nap: 1.5, libelle: "Peu actif" },
  { nap: 1.6, libelle: "Moyennement actif" },
  { nap: 1.75, libelle: "Actif" },
  { nap: 1.9, libelle: "Très actif" },
] as const;

export function libelleActivite(nap: number): string {
  const proche = NIVEAUX_ACTIVITE.reduce((a, b) => (Math.abs(b.nap - nap) < Math.abs(a.nap - nap) ? b : a));
  return Math.abs(proche.nap - nap) < 0.051 ? proche.libelle : "Personnalisé";
}

/** Âge en années révolues à la date `jour` (AAAA-MM-JJ). */
export function ageEn(dateNaissance: string, jour: string): number {
  const [a, m, j] = dateNaissance.split("-").map(Number);
  const [A, M, J] = jour.split("-").map(Number);
  return A - a - (M < m || (M === m && J < j) ? 1 : 0);
}

const KCAL_PAR_MJ = 238.85;

/** Métabolisme de base en kcal/jour (poids en kg, taille en cm, âge en années). */
export function metabolismeBase(f: { formule: Formule; sexe: Sexe; poids: number; taille: number; age: number }): number | null {
  const { poids: P, taille: T, age: A, sexe } = f;
  if (!(P > 0 && T > 0 && A > 0)) return null;
  switch (f.formule) {
    case "black":
      return (sexe === "femme" ? 0.963 : 1.083) * P ** 0.48 * (T / 100) ** 0.5 * A ** -0.13 * KCAL_PAR_MJ;
    case "mifflin":
      return 10 * P + 6.25 * T - 5 * A + (sexe === "femme" ? -161 : 5);
    case "harris":
      return sexe === "femme" ? 447.593 + 9.247 * P + 3.098 * T - 4.33 * A : 88.362 + 13.397 * P + 4.799 * T - 5.677 * A;
  }
}

export type Repartition = { lipides: number; glucides: number; proteines: number };

/** Grammes de chaque macro pour des calories et une répartition en % (lipides 9 kcal/g, glucides et protéines 4). */
export function grammesMacros(kcal: number, pct: Repartition): Repartition {
  return {
    lipides: (kcal * pct.lipides) / 100 / 9,
    glucides: (kcal * pct.glucides) / 100 / 4,
    proteines: (kcal * pct.proteines) / 100 / 4,
  };
}

/** Ajuste les deux autres % pour que le total reste à 100 quand on bouge un curseur. */
export function reequilibrer(pct: Repartition, change: keyof Repartition, valeur: number): Repartition {
  const v = Math.max(0, Math.min(100, Math.round(valeur)));
  const autres = (Object.keys(pct) as (keyof Repartition)[]).filter((k) => k !== change);
  const reste = 100 - v;
  const somme = autres.reduce((s, k) => s + pct[k], 0);
  const [a, b] = autres;
  const va = somme > 0 ? Math.round((pct[a] / somme) * reste) : Math.round(reste / 2);
  return { ...pct, [change]: v, [a]: va, [b]: reste - va } as Repartition;
}

/** Repères ANSES (adulte) affichés à côté des curseurs. */
export const REPERES_MACROS: Record<keyof Repartition, string> = {
  lipides: "35 – 40 %",
  glucides: "40 – 55 %",
  proteines: "10 – 20 %",
};

// ---------------------------------------------------------------- Contenu du plan

/** Aliment copié dans le plan : valeurs pour 100 g. `f` = fibres (null si inconnues). */
export type AlimentPlan = {
  id: string;
  nom: string;
  p: number;
  g: number;
  l: number;
  k: number;
  f: number | null;
  nom_unite: string | null;
  poids_unite_g: number | null;
};
export type Choix = { aliment: AlimentPlan; quantite: number; unite: Unite; manuel?: boolean };
export type Base = "kcal" | "proteines" | "glucides" | "lipides";
export const BASES: Record<Base, string> = { kcal: "calories", proteines: "protéines", glucides: "glucides", lipides: "lipides" };
export type Ligne = { principal: Choix; alternatives: Choix[]; base: Base };
export type RepasPlan = { libelle: string; heure: string | null; lignes: Ligne[]; note: string };
export type Objectifs = { kcal: number; proteines: number; glucides: number; lipides: number; fibres: number | null };
export type ContenuPlan = { repas: RepasPlan[]; objectifs: Objectifs | null };

export type Apports = { kcal: number; proteines: number; glucides: number; lipides: number; fibres: number; fibresIncompletes: boolean };
const VIDE: Apports = { kcal: 0, proteines: 0, glucides: 0, lipides: 0, fibres: 0, fibresIncompletes: false };

export function grammes(c: Pick<Choix, "quantite" | "unite"> & { aliment: Pick<AlimentPlan, "poids_unite_g"> }): number {
  return c.unite === "unite" ? c.quantite * (c.aliment.poids_unite_g ?? 0) : c.quantite;
}

export function apportsChoix(c: Choix): Apports {
  const x = grammes(c) / 100;
  const a = c.aliment;
  return { kcal: a.k * x, proteines: a.p * x, glucides: a.g * x, lipides: a.l * x, fibres: (a.f ?? 0) * x, fibresIncompletes: a.f == null };
}

export function additionnerApports(liste: Apports[]): Apports {
  return liste.reduce(
    (t, a) => ({
      kcal: t.kcal + a.kcal,
      proteines: t.proteines + a.proteines,
      glucides: t.glucides + a.glucides,
      lipides: t.lipides + a.lipides,
      fibres: t.fibres + a.fibres,
      fibresIncompletes: t.fibresIncompletes || a.fibresIncompletes,
    }),
    VIDE,
  );
}

/** Un repas compte l'aliment principal de chaque ligne (les alternatives sont équivalentes). */
export function apportsRepas(r: RepasPlan): Apports {
  return additionnerApports(r.lignes.map((l) => apportsChoix(l.principal)));
}

export function apportsPlan(c: Pick<ContenuPlan, "repas">): Apports {
  return additionnerApports(c.repas.map(apportsRepas));
}

/** Valeur de la base d'équivalence pour 1 g d'aliment. */
function parGramme(a: AlimentPlan, base: Base): number {
  const v = { kcal: a.k, proteines: a.p, glucides: a.g, lipides: a.l }[base];
  return (Number(v) || 0) / 100;
}

/** Arrondi lisible : 1 g sous 10 g, 5 g jusqu'à 200 g, 10 g au-delà. */
export function arrondiGrammes(g: number): number {
  const pas = g < 10 ? 1 : g < 200 ? 5 : 10;
  return Math.max(pas, Math.round(g / pas) * pas);
}

/** Arrondi d'un nombre d'unités : à la demi-unité, au moins une demie. */
export function arrondiUnites(n: number): number {
  return Math.max(0.5, Math.round(n * 2) / 2);
}

/**
 * Quantité de `vers` qui apporte autant que `depuis` (calories, ou la macro choisie).
 * Si l'aliment ne contient pas cette macro, on se rabat sur les calories.
 */
export function quantiteEquivalente(depuis: Choix, vers: AlimentPlan, base: Base, unite: Unite = "g"): number | null {
  let b = base;
  if (parGramme(vers, b) <= 0 || parGramme(depuis.aliment, b) <= 0) b = "kcal";
  const cible = grammes(depuis) * parGramme(depuis.aliment, b);
  const v = parGramme(vers, b);
  if (!(cible > 0 && v > 0)) return null;
  const g = cible / v;
  if (unite === "unite") return vers.poids_unite_g ? arrondiUnites(g / vers.poids_unite_g) : null;
  return arrondiGrammes(g);
}

/** Recalcule les alternatives qui n'ont pas été corrigées à la main. */
export function recalculerLigne(l: Ligne): Ligne {
  return {
    ...l,
    alternatives: l.alternatives.map((a) => {
      if (a.manuel) return a;
      const q = quantiteEquivalente(l.principal, a.aliment, l.base, a.unite);
      return q == null ? a : { ...a, quantite: q };
    }),
  };
}

/** « 40 g d'avocat » → « 40 g · Avocat » ; « 3 œufs ». */
export function texteChoix(c: Choix, nom: (n: string) => string = (n) => n): string {
  const quantite = formaterQuantite(c.quantite, c.unite, c.aliment.nom_unite);
  // « 1 œuf · Œuf » → « 1 œuf » : le nom de l'unité dit déjà tout.
  const simple = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/œ/gi, "oe").toLowerCase().trim();
  if (c.unite === "unite" && c.aliment.nom_unite && simple(nom(c.aliment.nom)) === simple(c.aliment.nom_unite)) return quantite;
  return `${quantite} · ${nom(c.aliment.nom)}`;
}

/** Repas à montrer à la cliente : ceux qui ont au moins un aliment ou une note. */
export function repasRemplis(c: Pick<ContenuPlan, "repas">): RepasPlan[] {
  return c.repas.filter((r) => r.lignes.length > 0 || r.note.trim());
}

/** Écart en % entre une valeur et sa cible (null sans cible). */
export function ecartPct(valeur: number, cible: number | null | undefined): number | null {
  if (!cible) return null;
  return ((valeur - cible) / cible) * 100;
}

/** Heures proposées par défaut selon le repas. */
export function heureParDefaut(libelle: string): string | null {
  const n = libelle.toLowerCase();
  if (n.includes("petit")) return "07:30";
  if (n.includes("déjeuner") || n.includes("dejeuner")) return "12:30";
  if (n.includes("goûter") || n.includes("gouter")) return "16:30";
  if (n.includes("dîner") || n.includes("diner")) return "19:30";
  return null;
}

// ---------------------------------------------------------------- Lecture sûre du JSON

export const LIMITES = { repas: 12, lignes: 30, alternatives: 20, note: 3000, libelle: 40 };

const nombre = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const texte = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");

function lireAliment(v: unknown): AlimentPlan | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = texte(o.id, 64);
  const nom = texte(o.nom, 200).trim();
  const p = nombre(o.p, 0, 100), g = nombre(o.g, 0, 100), l = nombre(o.l, 0, 100), k = nombre(o.k, 0, 950);
  if (!id || !nom || p == null || g == null || l == null || k == null) return null;
  const pu = nombre(o.poids_unite_g, 0.1, 2000);
  return { id, nom, p, g, l, k, f: nombre(o.f, 0, 100), nom_unite: texte(o.nom_unite, 40).trim() || null, poids_unite_g: pu };
}

function lireChoix(v: unknown): Choix | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const aliment = lireAliment(o.aliment);
  const unite: Unite = o.unite === "unite" && aliment?.poids_unite_g ? "unite" : "g";
  const quantite = nombre(o.quantite, 0, unite === "unite" ? 50 : 5000);
  if (!aliment || quantite == null) return null;
  return { aliment, quantite, unite, ...(o.manuel === true ? { manuel: true } : {}) };
}

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const BASES_VALIDES = Object.keys(BASES) as Base[];

/** Valide et nettoie un contenu de plan (venant du navigateur ou de la base). */
export function lireContenu(v: unknown): ContenuPlan {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const repas = (Array.isArray(o.repas) ? o.repas : []).slice(0, LIMITES.repas).flatMap((r): RepasPlan[] => {
    if (!r || typeof r !== "object") return [];
    const x = r as Record<string, unknown>;
    const lignes = (Array.isArray(x.lignes) ? x.lignes : []).slice(0, LIMITES.lignes).flatMap((l): Ligne[] => {
      if (!l || typeof l !== "object") return [];
      const y = l as Record<string, unknown>;
      const principal = lireChoix(y.principal);
      if (!principal) return [];
      const alternatives = (Array.isArray(y.alternatives) ? y.alternatives : [])
        .slice(0, LIMITES.alternatives)
        .flatMap((a) => (lireChoix(a) ? [lireChoix(a)!] : []));
      const base = BASES_VALIDES.includes(y.base as Base) ? (y.base as Base) : "kcal";
      return [{ principal, alternatives, base }];
    });
    const heure = typeof x.heure === "string" && HEURE.test(x.heure) ? x.heure : null;
    return [{ libelle: texte(x.libelle, LIMITES.libelle).trim() || "Repas", heure, lignes, note: texte(x.note, LIMITES.note) }];
  });
  const ob = (o.objectifs && typeof o.objectifs === "object" ? o.objectifs : null) as Record<string, unknown> | null;
  const kcal = ob ? nombre(ob.kcal, 500, 8000) : null;
  const objectifs: Objectifs | null =
    ob && kcal != null
      ? {
          kcal,
          proteines: nombre(ob.proteines, 0, 600) ?? 0,
          glucides: nombre(ob.glucides, 0, 1200) ?? 0,
          lipides: nombre(ob.lipides, 0, 400) ?? 0,
          fibres: nombre(ob.fibres, 0, 100),
        }
      : null;
  return { repas, objectifs };
}

/** Couleurs des macros (mêmes repères que Nutrium : lipides jaune, glucides orange, protéines bleu). */
export const COULEURS_MACROS = { lipides: "#e3b341", glucides: "#e39a6f", proteines: "#76a9e0", fibres: "#5fa88a", kcal: "#b48ab8" } as const;
