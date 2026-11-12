/** Données réelles du dépôt (Ciqual + recettes de départ), au format du moteur — pour les tests. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { IngredientMoteur, RecetteMoteur } from "../moteur";
import { UNITES_PAR_DEFAUT } from "../unites-defaut";

type Ciq = { c: string; n: string; p: number; gl: number; l: number; k: number; cat: string[] };
type Dep = {
  aliments_perso: { nom: string; p: number; g: number; l: number; k: number; categories: string[] }[];
  recettes: { titre: string; repas: string[]; ingredients: { a: string; role: string; unite: string; base: number; min: number; max: number; pas: number }[] }[];
};

const racine = join(__dirname, "..", "..", "..", "data");
const ciqual = (JSON.parse(readFileSync(join(racine, "ciqual.json"), "utf8")) as { aliments: Ciq[] }).aliments;
const depart = JSON.parse(readFileSync(join(racine, "recettes-depart.json"), "utf8")) as Dep;
const parCode = new Map(ciqual.map((a) => [a.c, a]));

export function aliment(ref: string): IngredientMoteur["aliment"] & { nom: string } {
  if (ref.startsWith("ciqual:")) {
    const a = parCode.get(ref.slice(7));
    if (!a) throw new Error(`Code Ciqual inconnu : ${ref}`);
    return {
      id: ref,
      nom: a.n,
      proteines_100: a.p,
      glucides_100: a.gl,
      lipides_100: a.l,
      kcal_100: a.k,
      poids_unite_g: UNITES_PAR_DEFAUT[a.c]?.[1] ?? null,
      categories: a.cat,
    };
  }
  const p = depart.aliments_perso.find((x) => x.nom === ref.slice(6));
  if (!p) throw new Error(`Aliment perso inconnu : ${ref}`);
  return { id: ref, nom: p.nom, proteines_100: p.p, glucides_100: p.g, lipides_100: p.l, kcal_100: p.k, poids_unite_g: null, categories: p.categories };
}

export type RecetteTest = RecetteMoteur & { noms: string[] };

export const RECETTES: RecetteTest[] = depart.recettes.map((r) => ({
  id: r.titre,
  titre: r.titre,
  repas: r.repas,
  noms: r.ingredients.map((i) => aliment(i.a).nom),
  ingredients: r.ingredients.map((i, k) => ({
    id: `${r.titre}#${k}`,
    role: i.role as IngredientMoteur["role"],
    unite: i.unite as "g" | "unite",
    base: i.base,
    min: i.min,
    max: i.max,
    pas: i.pas,
    aliment: aliment(i.a),
  })),
}));

export const recette = (titre: string) => {
  const r = RECETTES.find((x) => x.titre === titre);
  if (!r) throw new Error(`Recette inconnue : ${titre}`);
  return r;
};
