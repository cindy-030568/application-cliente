/**
 * Calculs nutritionnels partagés (dashboard coach, moteur de recettes).
 * Tous les apports sont exprimés pour la quantité réellement utilisée.
 */

export type Macros = { proteines: number; glucides: number; lipides: number; kcal: number };

export type AlimentNutrition = {
  proteines_100: number;
  glucides_100: number;
  lipides_100: number;
  kcal_100: number;
  poids_unite_g: number | null;
};

export type Unite = "g" | "unite";

export const ZERO: Macros = { proteines: 0, glucides: 0, lipides: 0, kcal: 0 };

/** Poids en grammes d'une quantité exprimée en grammes ou en unités (œuf, tranche…). */
export function enGrammes(qte: number, unite: Unite, aliment: Pick<AlimentNutrition, "poids_unite_g">): number {
  if (unite === "unite") return qte * (aliment.poids_unite_g ?? 0);
  return qte;
}

export function macrosDe(aliment: AlimentNutrition, qte: number, unite: Unite = "g"): Macros {
  const f = enGrammes(qte, unite, aliment) / 100;
  return {
    proteines: Number(aliment.proteines_100) * f,
    glucides: Number(aliment.glucides_100) * f,
    lipides: Number(aliment.lipides_100) * f,
    kcal: Number(aliment.kcal_100) * f,
  };
}

export function additionner(liste: Macros[]): Macros {
  return liste.reduce(
    (t, m) => ({
      proteines: t.proteines + m.proteines,
      glucides: t.glucides + m.glucides,
      lipides: t.lipides + m.lipides,
      kcal: t.kcal + m.kcal,
    }),
    ZERO,
  );
}

/** kcal à partir des macros (4 / 4 / 9), comme pour les cibles des repas. */
export function kcalDesMacros(p: number, g: number, l: number): number {
  return 4 * p + 4 * g + 9 * l;
}

export function arrondir(n: number, decimales = 0): number {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

export const LIBELLES_REPAS = {
  petit_dejeuner: "Petit-déjeuner",
  dejeuner: "Déjeuner",
  gouter: "Goûter",
  diner: "Dîner",
  collation: "Collation",
} as const;
export type TypeRepas = keyof typeof LIBELLES_REPAS;

/** Types de repas des recettes (« collation » couvre aussi le goûter). */
export const REPAS_RECETTE = {
  petit_dejeuner: "Petit-déjeuner",
  dejeuner: "Déjeuner",
  diner: "Dîner",
  collation: "Goûter / collation",
} as const;
export type TypeRepasRecette = keyof typeof REPAS_RECETTE;

export function typeRecettePourRepas(t: TypeRepas): TypeRepasRecette {
  return t === "gouter" ? "collation" : t;
}

export const ROLES = {
  proteine: { libelle: "Protéine", aide: "Ajustée pour atteindre la cible de protéines" },
  glucide: { libelle: "Glucide", aide: "Ajustée pour atteindre la cible de glucides" },
  lipide: { libelle: "Lipide", aide: "Ajustée pour atteindre la cible de lipides" },
  fruit: { libelle: "Fruit", aide: "Ajusté dans sa fourchette" },
  fixe: { libelle: "Fixe", aide: "Légumes, épices, sauces légères : ne bouge pas" },
} as const;
export type Role = keyof typeof ROLES;

const FACTEURS: Record<Exclude<Role, "fixe">, [number, number]> = {
  proteine: [0.5, 2],
  glucide: [0.4, 2.2],
  lipide: [0.3, 2.5],
  fruit: [0.5, 1.6],
};

/** Fourchette proposée par défaut pour un ingrédient (la coach peut la modifier). */
export function bornesParDefaut(role: Role, base: number, unite: Unite, pas: number): { min: number; max: number } {
  if (role === "fixe") return { min: base, max: base };
  const [bas, haut] = FACTEURS[role];
  if (unite === "unite") return { min: Math.max(1, Math.floor(base * bas)), max: Math.max(base, Math.ceil(base * haut)) };
  const arrondi = (x: number) => Math.max(pas, Math.round(x / pas) * pas);
  const min = role === "lipide" && base <= 10 ? 0 : Math.min(base, arrondi(base * bas));
  return { min, max: Math.max(base, arrondi(base * haut)) };
}

/** Rôle deviné d'après la composition de l'aliment. */
export function roleSuggere(a: {
  proteines_100: number;
  glucides_100: number;
  lipides_100: number;
  sous_groupe?: string | null;
  groupe?: string | null;
}): Role {
  const sg = (a.sous_groupe ?? "").toLowerCase();
  if (sg === "fruits") return "fruit";
  if (["légumes", "herbes", "épices", "condiments", "sauces", "aides culinaires", "algues", "sels"].includes(sg)) return "fixe";
  const p = 4 * a.proteines_100;
  const g = 4 * a.glucides_100;
  const l = 9 * a.lipides_100;
  if (p + g + l < 60) return "fixe";
  if (p >= g && p >= l) return "proteine";
  if (l >= g) return "lipide";
  return "glucide";
}
