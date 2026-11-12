"use server";

import { revalidatePath } from "next/cache";
import { UUID, verifierCliente } from "./verification";

export type EtatNutrition = { erreur?: string; succes?: string };
const TYPES = ["petit_dejeuner", "dejeuner", "gouter", "diner", "collation"] as const;

export type RepasSaisi = { type_repas: string; libelle: string; proteines_g: number; glucides_g: number; lipides_g: number };

/** Remplace la liste des repas et de leurs cibles. */
export async function enregistrerRepas(clienteId: string, repas: RepasSaisi[]): Promise<EtatNutrition> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };
  if (!Array.isArray(repas) || repas.length > 10) return { erreur: "10 repas maximum." };
  for (const [i, r] of repas.entries()) {
    if (!(TYPES as readonly string[]).includes(r.type_repas)) return { erreur: `Repas ${i + 1} : type inconnu.` };
    if (!r.libelle?.trim()) return { erreur: `Repas ${i + 1} : donne-lui un nom.` };
    const bornes: [number, number, string][] = [[r.proteines_g, 300, "protéines"], [r.glucides_g, 500, "glucides"], [r.lipides_g, 200, "lipides"]];
    for (const [val, max, nom] of bornes) {
      if (!Number.isFinite(val) || val < 0 || val > max) return { erreur: `${r.libelle} : la cible de ${nom} n’est pas valide.` };
    }
  }
  const { error: e1 } = await v.supabase.from("repas_cibles").delete().eq("cliente_id", clienteId);
  if (e1) return { erreur: "L’enregistrement a échoué." };
  if (repas.length) {
    const { error } = await v.supabase.from("repas_cibles").insert(
      repas.map((r, ordre) => ({
        cliente_id: clienteId,
        type_repas: r.type_repas,
        libelle: r.libelle.trim().slice(0, 40),
        ordre,
        proteines_g: Math.round(r.proteines_g * 10) / 10,
        glucides_g: Math.round(r.glucides_g * 10) / 10,
        lipides_g: Math.round(r.lipides_g * 10) / 10,
      })),
    );
    if (error) return { erreur: "L’enregistrement a échoué." };
  }
  revalidatePath(`/coach/clientes/${clienteId}`);
  revalidatePath("/recettes", "layout");
  return { succes: "Repas et cibles enregistrés." };
}

/** Remplace les exclusions (catégories entières et aliments précis). */
export async function enregistrerExclusions(
  clienteId: string,
  categories: string[],
  aliments: string[],
): Promise<EtatNutrition> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };
  const cats = [...new Set(categories)].filter((c) => UUID.test(c));
  const alis = [...new Set(aliments)].filter((a) => UUID.test(a)).slice(0, 200);
  const { error: e1 } = await v.supabase.from("exclusions").delete().eq("cliente_id", clienteId);
  if (e1) return { erreur: "L’enregistrement a échoué." };
  const lignes = [
    ...cats.map((categorie_id) => ({ cliente_id: clienteId, categorie_id })),
    ...alis.map((aliment_id) => ({ cliente_id: clienteId, aliment_id })),
  ];
  if (lignes.length) {
    const { error } = await v.supabase.from("exclusions").insert(lignes);
    if (error) return { erreur: "L’enregistrement a échoué." };
  }
  revalidatePath(`/coach/clientes/${clienteId}`);
  revalidatePath("/recettes", "layout");
  return { succes: "Exclusions enregistrées." };
}
