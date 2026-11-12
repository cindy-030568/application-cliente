"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { lireReglages, lireSession } from "@/lib/auth";
import { PORTIONS_MAX, nomCourt, rayonPour } from "@/lib/courses";
import { recettesAdapteesCliente, trouverAdaptation } from "@/lib/recettes-adaptees";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_EXPIREE = "Ta session a expiré. Reconnecte-toi, puis réessaie.";

export type EtatAction = { erreur?: string; succes?: string };

/** Session d'une cliente dont l'accès est ouvert (jamais la coach). */
async function sessionCliente() {
  const session = await lireSession();
  if (!session || session.profil.role !== "cliente") return null;
  const { data } = await session.supabase.from("clientes").select("statut").eq("id", session.profil.id).maybeSingle();
  if (!data || data.statut === "fermee") return null;
  return session;
}

export async function basculerFavori(recetteId: string): Promise<{ favori?: boolean; erreur?: string }> {
  const session = await sessionCliente();
  if (!session) return { erreur: SESSION_EXPIREE };
  if (!UUID.test(recetteId)) return { erreur: "Recette introuvable." };
  const { supabase, profil } = session;
  const { data: existe } = await supabase
    .from("favoris")
    .select("recette_id")
    .eq("cliente_id", profil.id)
    .eq("recette_id", recetteId)
    .maybeSingle();
  if (existe) {
    const { error } = await supabase.from("favoris").delete().eq("cliente_id", profil.id).eq("recette_id", recetteId);
    if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  } else {
    const { error } = await supabase.from("favoris").insert({ cliente_id: profil.id, recette_id: recetteId });
    if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  }
  revalidatePath("/recettes", "layout");
  return { favori: !existe };
}

type AlimentRayon = {
  groupe: string | null;
  sous_groupe: string | null;
  aliments_categories: { categories_aliment: { nom: string } | { nom: string }[] | null }[] | null;
};
function categoriesDe(a: AlimentRayon | undefined): string[] {
  return (a?.aliments_categories ?? []).flatMap((x) =>
    Array.isArray(x.categories_aliment) ? x.categories_aliment.map((c) => c.nom) : x.categories_aliment ? [x.categories_aliment.nom] : [],
  );
}

/** Ajoute les ingrédients d'une recette à la liste de courses, avec SES quantités (recalculées ici). */
export async function ajouterAuxCourses(recetteId: string, indexRepas: number, portions: number): Promise<EtatAction> {
  const session = await sessionCliente();
  if (!session) return { erreur: SESSION_EXPIREE };
  if (!UUID.test(recetteId) || !Number.isInteger(indexRepas) || indexRepas < 0) return { erreur: "Recette introuvable." };
  if (!Number.isInteger(portions) || portions < 1 || portions > PORTIONS_MAX) return { erreur: "Nombre de portions invalide." };
  const { supabase, profil } = session;

  const repas = await recettesAdapteesCliente(supabase, profil.id, await lireReglages());
  const adaptation = trouverAdaptation(repas, indexRepas, recetteId);
  if (!adaptation) return { erreur: "Cette recette n’est plus proposée pour ce repas." };
  const recette = adaptation.recette.source;

  const { data: aliments } = await supabase
    .from("aliments")
    .select("id, groupe, sous_groupe, aliments_categories(categories_aliment(nom))")
    .in("id", recette.ingredients.map((i) => i.aliment_id));
  const groupes = new Map((aliments ?? []).map((a) => [a.id as string, a as unknown as AlimentRayon]));
  const quantites = new Map(adaptation.resultat.quantites.map((q) => [q.id, q.quantite]));
  const lot = randomUUID();
  const lignes = recette.ingredients
    .map((i) => ({ i, q: (quantites.get(i.id) ?? i.qte_base) * portions }))
    .filter(({ q }) => q > 0)
    .map(({ i, q }) => {
      const g = groupes.get(i.aliment_id);
      return {
        cliente_id: profil.id,
        lot,
        recette_id: recette.id,
        recette_titre: recette.titre,
        portions,
        aliment_id: i.aliment_id,
        nom: nomCourt(i.aliment.nom),
        rayon: rayonPour(g?.groupe ?? null, g?.sous_groupe ?? null, categoriesDe(g), i.aliment.nom),
        quantite: Math.round(q * 10) / 10,
        unite: i.unite,
        nom_unite: i.unite === "unite" ? i.aliment.nom_unite : null,
      };
    });
  const { error } = await supabase.from("courses").insert(lignes);
  if (error) {
    return {
      erreur: error.code === "23514" ? "Ta liste de courses est pleine : retire quelques articles d’abord." : "L’ajout a échoué. Réessaie.",
    };
  }
  revalidatePath("/recettes/courses");
  return { succes: "Ajoutée à ta liste de courses." };
}

export async function cocherArticles(ids: string[], coche: boolean): Promise<EtatAction> {
  const session = await sessionCliente();
  if (!session) return { erreur: SESSION_EXPIREE };
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 300 || !ids.every((id) => UUID.test(id))) return {};
  const { error } = await session.supabase.from("courses").update({ coche }).in("id", ids);
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  revalidatePath("/recettes/courses");
  return {};
}

export async function ajouterArticle(_e: EtatAction, formData: FormData): Promise<EtatAction> {
  const session = await sessionCliente();
  if (!session) return { erreur: SESSION_EXPIREE };
  const nom = String(formData.get("nom") ?? "").trim().slice(0, 120);
  if (!nom) return { erreur: "Écris le nom de l’article." };
  const { error } = await session.supabase.from("courses").insert({ cliente_id: session.profil.id, nom });
  if (error) {
    return { erreur: error.code === "23514" ? "Ta liste de courses est pleine : retire quelques articles d’abord." : "L’ajout a échoué." };
  }
  revalidatePath("/recettes/courses");
  return { succes: "Ajouté." };
}

export async function retirerCoches(): Promise<EtatAction> {
  const session = await sessionCliente();
  if (!session) return { erreur: SESSION_EXPIREE };
  const { error } = await session.supabase.from("courses").delete().eq("cliente_id", session.profil.id).eq("coche", true);
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  revalidatePath("/recettes/courses");
  return {};
}

export async function viderListe(): Promise<EtatAction> {
  const session = await sessionCliente();
  if (!session) return { erreur: SESSION_EXPIREE };
  const { error } = await session.supabase.from("courses").delete().eq("cliente_id", session.profil.id);
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  revalidatePath("/recettes/courses");
  return {};
}

export async function retirerRecetteDesCourses(lot: string): Promise<EtatAction> {
  const session = await sessionCliente();
  if (!session) return { erreur: SESSION_EXPIREE };
  if (!UUID.test(lot)) return {};
  const { error } = await session.supabase.from("courses").delete().eq("cliente_id", session.profil.id).eq("lot", lot);
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  revalidatePath("/recettes/courses");
  return {};
}
