/**
 * Moteur de recettes adaptées.
 *
 * Pour une recette et les cibles d'un repas (protéines, glucides, lipides en g),
 * calcule la quantité de chaque ingrédient :
 *  1. Variables : les ingrédients non « fixe », bornés par [min, max].
 *     Tous les ingrédients comptent dans toutes les macros (un œuf apporte aussi des lipides).
 *  2. Moindres carrés bornés (descente par coordonnées, exacte sur un problème convexe) :
 *     on minimise l'écart relatif aux trois cibles, plus un léger rappel vers les
 *     proportions de la recette (pour éviter « 0 g de pâtes et 400 g de poulet »).
 *  3. Arrondi au pas de chaque ingrédient (5 g, 1 œuf…), dans les bornes.
 *  4. Ajustement fin : ±1 pas par ingrédient tant que ça rapproche des cibles.
 *  5. Verdict : compatible si CHAQUE macro est dans la tolérance
 *     (max(tolérance % × cible, tolérance g)).
 *
 * Module pur, sans dépendance à la base de données : entièrement testable.
 */

export type RoleIngredient = "proteine" | "glucide" | "lipide" | "fruit" | "fixe";

export type IngredientMoteur = {
  id: string;
  role: RoleIngredient;
  unite: "g" | "unite";
  base: number;
  min: number;
  max: number;
  pas: number;
  aliment: {
    id: string;
    proteines_100: number;
    glucides_100: number;
    lipides_100: number;
    kcal_100: number;
    poids_unite_g: number | null;
    categories?: string[];
  };
};

export type Cible = { proteines: number; glucides: number; lipides: number };
export type Tolerance = { pct: number; g: number };
export type MacrosReelles = { proteines: number; glucides: number; lipides: number; kcal: number };

export type ResultatMoteur = {
  quantites: { id: string; quantite: number; grammes: number }[];
  macros: MacrosReelles;
  ecarts: Cible;
  /** Écart autorisé pour chaque macro. */
  tolerances: Cible;
  compatible: boolean;
  /** Plus c'est petit, plus la recette colle aux cibles (pour trier). */
  score: number;
};

const MACROS = ["proteines", "glucides", "lipides"] as const;
const POIDS_PROPORTIONS = 0.04;

function grammesParUnite(i: IngredientMoteur): number {
  return i.unite === "unite" ? (i.aliment.poids_unite_g ?? 0) : 1;
}

/** Apport d'UNE unité de quantité (1 g, ou 1 œuf…) pour chaque macro. */
function apportUnitaire(i: IngredientMoteur): [number, number, number] {
  const f = grammesParUnite(i) / 100;
  return [i.aliment.proteines_100 * f, i.aliment.glucides_100 * f, i.aliment.lipides_100 * f];
}

export function macrosPour(ingredients: IngredientMoteur[], quantites: number[]): MacrosReelles {
  const t = { proteines: 0, glucides: 0, lipides: 0, kcal: 0 };
  ingredients.forEach((ing, k) => {
    const grammes = quantites[k] * grammesParUnite(ing);
    t.proteines += (ing.aliment.proteines_100 * grammes) / 100;
    t.glucides += (ing.aliment.glucides_100 * grammes) / 100;
    t.lipides += (ing.aliment.lipides_100 * grammes) / 100;
    t.kcal += (ing.aliment.kcal_100 * grammes) / 100;
  });
  return t;
}

export function tolerancesPour(cible: Cible, tol: Tolerance): Cible {
  return {
    proteines: Math.max((tol.pct / 100) * cible.proteines, tol.g),
    glucides: Math.max((tol.pct / 100) * cible.glucides, tol.g),
    lipides: Math.max((tol.pct / 100) * cible.lipides, tol.g),
  };
}

const borner = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Bornes réellement atteignables au pas (ex. min 7 avec un pas de 5 → 10). */
function bornesAuPas(i: IngredientMoteur): [number, number] {
  const lo = Math.ceil(i.min / i.pas - 1e-9) * i.pas;
  const hi = Math.floor(i.max / i.pas + 1e-9) * i.pas;
  return lo <= hi ? [lo, hi] : [i.base, i.base];
}

/**
 * Évaluation d'une combinaison arrondie : d'abord le dépassement de tolérance
 * (en g, au-delà de l'écart permis), puis l'écart relatif au carré.
 */
function evaluer(m: MacrosReelles, cible: Cible, tols: Cible): [number, number] {
  let depassement = 0;
  let relatif = 0;
  for (const k of MACROS) {
    const e = Math.abs(m[k] - cible[k]);
    depassement += Math.max(0, e - tols[k]) / Math.max(tols[k], 1);
    relatif += (e / Math.max(cible[k], 5)) ** 2;
  }
  return [depassement, relatif];
}

const meilleur = (a: [number, number], b: [number, number]) =>
  a[0] < b[0] - 1e-9 || (Math.abs(a[0] - b[0]) <= 1e-9 && a[1] < b[1] - 1e-12);

export function adapterRecette(ingredients: IngredientMoteur[], cible: Cible, tol: Tolerance): ResultatMoteur {
  const n = ingredients.length;
  const variables = ingredients.map((i, k) => (i.role === "fixe" || i.min === i.max ? -1 : k)).filter((k) => k >= 0);
  const x = ingredients.map((i) => i.base);
  const apports = ingredients.map(apportUnitaire);
  const echelles = MACROS.map((k) => Math.max(cible[k], 5));

  // Échelle globale de départ : rapport entre les kcal visées et celles de la recette de base.
  const base = macrosPour(ingredients, x);
  const kcalCible = 4 * cible.proteines + 4 * cible.glucides + 9 * cible.lipides;
  const kcalBase = 4 * base.proteines + 4 * base.glucides + 9 * base.lipides;
  const s = kcalBase > 0 ? borner(kcalCible / kcalBase, 0.3, 3) : 1;
  const reference = ingredients.map((i) => i.base * s);
  for (const k of variables) x[k] = borner(reference[k], ingredients[k].min, ingredients[k].max);

  // --- 2. Moindres carrés bornés, descente par coordonnées.
  // Lignes : 3 macros (pondérées par 1/échelle) + 1 ligne de rappel par variable.
  const total = (): number[] => {
    const t = [0, 0, 0];
    for (let k = 0; k < n; k++) for (let m = 0; m < 3; m++) t[m] += apports[k][m] * x[k];
    return t;
  };
  let t = total();
  for (let iter = 0; iter < 400; iter++) {
    let deplacement = 0;
    for (const j of variables) {
      const ing = ingredients[j];
      const poidsRappel = POIDS_PROPORTIONS / Math.max(reference[j], 1) ** 2;
      let num = 0;
      let den = poidsRappel;
      for (let m = 0; m < 3; m++) {
        const a = apports[j][m] / echelles[m];
        num += a * ((t[m] - MACROS.map((k) => cible[k])[m]) / echelles[m]);
        den += a * a;
      }
      num += poidsRappel * (x[j] - reference[j]);
      if (den <= 0) continue;
      const nouveau = borner(x[j] - num / den, ing.min, ing.max);
      const d = nouveau - x[j];
      if (d !== 0) {
        for (let m = 0; m < 3; m++) t[m] += apports[j][m] * d;
        x[j] = nouveau;
        deplacement = Math.max(deplacement, Math.abs(d) / Math.max(ing.pas, 1e-6));
      }
    }
    if (deplacement < 1e-4) break;
  }
  t = total();

  // --- 3. Arrondi au pas, dans les bornes atteignables.
  const q = x.map((v, k) => {
    const ing = ingredients[k];
    if (!variables.includes(k)) return ing.base;
    const [lo, hi] = bornesAuPas(ing);
    return borner(Math.round(v / ing.pas) * ing.pas, lo, hi);
  });

  // --- 4. Ajustement fin : ±1 pas, tant qu'on se rapproche des cibles.
  const tols = tolerancesPour(cible, tol);
  let actuel = evaluer(macrosPour(ingredients, q), cible, tols);
  for (let tour = 0; tour < 120; tour++) {
    let mieux: { k: number; v: number; e: [number, number] } | null = null;
    for (const k of variables) {
      const ing = ingredients[k];
      const [lo, hi] = bornesAuPas(ing);
      for (const sens of [-1, 1]) {
        const v = q[k] + sens * ing.pas;
        if (v < lo - 1e-9 || v > hi + 1e-9) continue;
        const ancien = q[k];
        q[k] = v;
        const e = evaluer(macrosPour(ingredients, q), cible, tols);
        q[k] = ancien;
        if (meilleur(e, mieux ? mieux.e : actuel)) mieux = { k, v, e };
      }
    }
    if (!mieux) {
      // Aucun pas isolé n'aide : on essaie d'échanger (un ingrédient monte, un autre descend).
      let echange: { k: number; vk: number; j: number; vj: number; e: [number, number] } | null = null;
      for (const k of variables) {
        for (const j of variables) {
          if (j === k) continue;
          const [lk, hk] = bornesAuPas(ingredients[k]);
          const [lj, hj] = bornesAuPas(ingredients[j]);
          const vk = q[k] + ingredients[k].pas;
          const vj = q[j] - ingredients[j].pas;
          if (vk > hk + 1e-9 || vj < lj - 1e-9 || vk < lk - 1e-9 || vj > hj + 1e-9) continue;
          const [ak, aj] = [q[k], q[j]];
          q[k] = vk;
          q[j] = vj;
          const e = evaluer(macrosPour(ingredients, q), cible, tols);
          q[k] = ak;
          q[j] = aj;
          if (meilleur(e, echange ? echange.e : actuel)) echange = { k, vk, j, vj, e };
        }
      }
      if (!echange) break;
      q[echange.k] = echange.vk;
      q[echange.j] = echange.vj;
      actuel = echange.e;
      continue;
    }
    q[mieux.k] = mieux.v;
    actuel = mieux.e;
  }

  // --- 4 bis. Encore hors tolérance : exploration complète, deux ingrédients à la fois
  // (toutes leurs combinaisons au pas, les autres fixés), répétée tant que ça progresse.
  const grilles = new Map<number, number[]>();
  for (const k of variables) {
    const [lo, hi] = bornesAuPas(ingredients[k]);
    const p = ingredients[k].pas;
    const valeurs: number[] = [];
    for (let v = lo; v <= hi + 1e-9 && valeurs.length < 400; v += p) valeurs.push(Math.round(v / p) * p);
    grilles.set(k, valeurs);
  }
  for (let passe = 0; passe < 6 && actuel[0] > 0; passe++) {
    let progres = false;
    for (let a = 0; a < variables.length; a++) {
      for (let b = a + 1; b < variables.length; b++) {
        const [k, j] = [variables[a], variables[b]];
        const [ak, aj] = [q[k], q[j]];
        let choix: [number, number] | null = null;
        for (const vk of grilles.get(k)!) {
          q[k] = vk;
          for (const vj of grilles.get(j)!) {
            q[j] = vj;
            const e = evaluer(macrosPour(ingredients, q), cible, tols);
            if (meilleur(e, actuel)) {
              actuel = e;
              choix = [vk, vj];
            }
          }
        }
        if (choix) {
          [q[k], q[j]] = choix;
          progres = true;
        } else {
          [q[k], q[j]] = [ak, aj];
        }
      }
    }
    if (!progres) break;
  }

  // --- 5. Verdict.
  const arrondi = (v: number) => Math.round(v * 1000) / 1000;
  const m = macrosPour(ingredients, q);
  const ecarts = {
    proteines: m.proteines - cible.proteines,
    glucides: m.glucides - cible.glucides,
    lipides: m.lipides - cible.lipides,
  };
  return {
    quantites: ingredients.map((i, k) => ({ id: i.id, quantite: arrondi(q[k]), grammes: arrondi(q[k] * grammesParUnite(i)) })),
    macros: m,
    ecarts,
    tolerances: tols,
    compatible: MACROS.every((k) => Math.abs(ecarts[k]) <= tols[k] + 1e-9),
    score: actuel[0] * 1000 + actuel[1],
  };
}

// ---------------------------------------------------------------------------
// Sélection des recettes pour une cliente et un repas
// ---------------------------------------------------------------------------

export type RecetteMoteur = {
  id: string;
  titre: string;
  repas: string[];
  ingredients: IngredientMoteur[];
};

export type Exclusions = { categories: Set<string>; aliments: Set<string> };

/** Vrai si un ingrédient de la recette est exclu (aliment précis ou catégorie). */
export function recetteExclue(r: RecetteMoteur, ex: Exclusions): boolean {
  return r.ingredients.some(
    (i) => ex.aliments.has(i.aliment.id) || (i.aliment.categories ?? []).some((c) => ex.categories.has(c)),
  );
}

export type RecetteAdaptee<R extends RecetteMoteur> = { recette: R; resultat: ResultatMoteur };

/**
 * Recettes proposées pour un repas : celles du bon type, sans aliment exclu,
 * adaptées aux cibles. Les compatibles d'abord (les plus proches en tête) ;
 * les « approximatives » ensuite seulement si `afficherApproximatives`.
 */
export function recettesPourRepas<R extends RecetteMoteur>(
  recettes: R[],
  typeRecette: string,
  cible: Cible,
  tol: Tolerance,
  ex: Exclusions,
  afficherApproximatives: boolean,
): { compatibles: RecetteAdaptee<R>[]; approximatives: RecetteAdaptee<R>[]; exclues: number } {
  let exclues = 0;
  const adaptees: RecetteAdaptee<R>[] = [];
  for (const r of recettes) {
    if (!r.repas.includes(typeRecette) || r.ingredients.length === 0) continue;
    if (recetteExclue(r, ex)) {
      exclues++;
      continue;
    }
    adaptees.push({ recette: r, resultat: adapterRecette(r.ingredients, cible, tol) });
  }
  const tri = (a: RecetteAdaptee<R>, b: RecetteAdaptee<R>) =>
    a.resultat.score - b.resultat.score || a.recette.titre.localeCompare(b.recette.titre, "fr");
  return {
    compatibles: adaptees.filter((a) => a.resultat.compatible).sort(tri),
    approximatives: afficherApproximatives ? adaptees.filter((a) => !a.resultat.compatible).sort(tri) : [],
    exclues,
  };
}
