/**
 * Méthode de l'assiette (espace abonnées) : les familles d'une recette, sans aucun calcul.
 * Rôles des ingrédients (recettes de la coach) : protéines, féculents, bonnes graisses, fruits, le reste.
 */
import type { IngredientRecette } from "./types";

export type FamilleAssiette = { code: "proteine" | "glucide" | "lipide" | "fruit"; libelle: string; emoji: string; repere: string };

export const FAMILLES: FamilleAssiette[] = [
  { code: "proteine", libelle: "Protéines", emoji: "🍗", repere: "environ ¼ de l’assiette (la taille de ta paume)" },
  { code: "glucide", libelle: "Féculents", emoji: "🍚", repere: "environ ¼ de l’assiette (ton poing fermé)" },
  { code: "lipide", libelle: "Bonnes graisses", emoji: "🫒", repere: "une petite touche (un pouce)" },
  { code: "fruit", libelle: "Fruits", emoji: "🍓", repere: "une portion" },
];

/** Les familles présentes dans une recette, avec leurs ingrédients. */
export function familles(ingredients: Pick<IngredientRecette, "role" | "aliment">[], nom: (n: string) => string = (n) => n) {
  return FAMILLES.map((f) => ({ ...f, aliments: ingredients.filter((i) => i.role === f.code).map((i) => nom(i.aliment.nom)) })).filter((f) => f.aliments.length > 0);
}
