"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { lireReglages, lireSession } from "@/lib/auth";
import { PORTIONS_MAX, nomCourt, rayonPour } from "@/lib/courses";
import { recettesAdapteesCliente, trouverAdaptation } from "@/lib/recettes-adaptees";
import { additionner, joursSemaine, titreLotSemaine, type QuantitePlanifiee } from "@/lib/planning";

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

// ---------------------------------------------------------------- Planning des repas de la semaine

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const MIGRATION_PLANNING = "Le planning n’est pas encore prêt : Cindy doit faire une mise à jour de l’appli.";

/** Choisit une recette pour un jour et un repas (remplace celle d'avant). La recette doit être proposée pour ce repas. */
export async function planifierRecette(jour: string, indexRepas: number, recetteId: string): Promise<EtatAction> {
  const session = await sessionCliente();
  if (!session) return { erreur: SESSION_EXPIREE };
  if (!JOUR.test(jour) || !UUID.test(recetteId) || !Number.isInteger(indexRepas) || indexRepas < 0) return { erreur: "Choix invalide." };
  const { supabase, profil } = session;
  const repas = await recettesAdapteesCliente(supabase, profil.id, await lireReglages());
  const adaptation = trouverAdaptation(repas, indexRepas, recetteId);
  if (!adaptation) return { erreur: "Cette recette n’est plus proposée pour ce repas." };
  const { error } = await supabase
    .from("planning_repas")
    .upsert({ cliente_id: profil.id, jour, repas_cible_id: adaptation.repas.repas.id, recette_id: recetteId, portions: 1 }, { onConflict: "cliente_id,jour,repas_cible_id" });
  if (error) return { erreur: ["42P01", "PGRST205"].includes(error.code) ? MIGRATION_PLANNING : error.code === "23514" ? "Ton planning est plein : retire d’anciennes semaines." : "Ça n’a pas fonctionné. Réessaie." };
  revalidatePath("/recettes/planning");
  return { succes: "Ajoutée à ton planning ✓" };
}

export async function retirerDuPlanning(jour: string, repasCibleId: string): Promise<EtatAction> {
  const session = await sessionCliente();
  if (!session) return { erreur: SESSION_EXPIREE };
  if (!JOUR.test(jour) || !UUID.test(repasCibleId)) return {};
  const { error } = await session.supabase.from("planning_repas").delete().eq("cliente_id", session.profil.id).eq("jour", jour).eq("repas_cible_id", repasCibleId);
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  revalidatePath("/recettes/planning");
  return {};
}

/**
 * Remplit la liste de courses avec toutes les recettes planifiées de la semaine :
 * quantités adaptées à ses repas, additionnées par aliment. Si la semaine avait déjà été ajoutée,
 * elle est remplacée (pas de doublon). Les articles ajoutés à la main ne sont pas touchés.
 */
export async function remplirCoursesSemaine(lundi: string): Promise<EtatAction> {
  const session = await sessionCliente();
  if (!session) return { erreur: SESSION_EXPIREE };
  if (!JOUR.test(lundi)) return { erreur: "Semaine invalide." };
  const { supabase, profil } = session;
  const jours = joursSemaine(lundi);
  const [repas, { data: planning, error: sansPlanning }] = await Promise.all([
    recettesAdapteesCliente(supabase, profil.id, await lireReglages()),
    supabase.from("planning_repas").select("jour, repas_cible_id, recette_id, portions").eq("cliente_id", profil.id).gte("jour", jours[0]).lte("jour", jours[6]),
  ]);
  if (sansPlanning) return { erreur: MIGRATION_PLANNING };
  const lignes: QuantitePlanifiee[] = [];
  let oubliees = 0;
  for (const p of planning ?? []) {
    const index = repas.findIndex((r) => r.repas.id === p.repas_cible_id);
    const adaptation = index < 0 ? null : trouverAdaptation(repas, index, p.recette_id as string);
    if (!adaptation) {
      oubliees++;
      continue;
    }
    const quantites = new Map(adaptation.resultat.quantites.map((q) => [q.id, q.quantite]));
    for (const i of adaptation.recette.source.ingredients) {
      lignes.push({
        aliment_id: i.aliment_id,
        nom: i.aliment.nom,
        unite: i.unite,
        nom_unite: i.unite === "unite" ? i.aliment.nom_unite : null,
        quantite: (quantites.get(i.id) ?? i.qte_base) * Number(p.portions ?? 1),
      });
    }
  }
  const total = additionner(lignes);
  if (!total.length) return { erreur: "Aucune recette dans ton planning cette semaine : choisis d’abord tes repas." };

  const { data: aliments } = await supabase
    .from("aliments")
    .select("id, groupe, sous_groupe, aliments_categories(categories_aliment(nom))")
    .in("id", total.map((l) => l.aliment_id));
  const groupes = new Map((aliments ?? []).map((a) => [a.id as string, a as unknown as AlimentRayon]));
  const titre = titreLotSemaine(lundi);
  // Remplace la semaine si elle avait déjà été ajoutée.
  await supabase.from("courses").delete().eq("cliente_id", profil.id).is("recette_id", null).eq("recette_titre", titre);
  const lot = randomUUID();
  const { error } = await supabase.from("courses").insert(
    total.map((l) => {
      const g = groupes.get(l.aliment_id);
      return {
        cliente_id: profil.id,
        lot,
        recette_id: null,
        recette_titre: titre,
        portions: null,
        aliment_id: l.aliment_id,
        nom: nomCourt(l.nom),
        rayon: rayonPour(g?.groupe ?? null, g?.sous_groupe ?? null, categoriesDe(g), l.nom),
        quantite: l.quantite,
        unite: l.unite,
        nom_unite: l.nom_unite,
      };
    }),
  );
  if (error) {
    return { erreur: error.code === "23514" ? "Ta liste de courses est pleine : retire quelques articles d’abord." : "L’ajout a échoué. Réessaie." };
  }
  revalidatePath("/recettes/courses");
  return {
    succes: `${total.length} article${total.length > 1 ? "s" : ""} ajouté${total.length > 1 ? "s" : ""} à ta liste de courses ✓${oubliees ? ` (${oubliees} recette${oubliees > 1 ? "s ne sont" : " n’est"} plus proposée${oubliees > 1 ? "s" : ""} pour ce repas : choisis-en une autre.)` : ""}`,
  };
}
