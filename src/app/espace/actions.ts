"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nomCourt, rayonPour } from "@/lib/courses";
import { quantitesDuMenu, titreLotMenu, type CaseMenu } from "@/lib/menus";
import { lireFormulaireMetabolisme } from "@/lib/metabolisme";
import { chargerRecettes } from "@/lib/recettes";
import { exigerAbonnee } from "@/lib/auth";
import { SITE_URL } from "@/lib/env";
import { creerSessionPortail } from "@/lib/stripe";

export type EtatEspace = { erreur?: string };

/** « Gérer mon abonnement » : l'espace sécurisé de Stripe (carte, factures, formule, résiliation). */
export async function gererAbonnement(): Promise<EtatEspace> {
  const { fiche } = await exigerAbonnee();
  if (!fiche.stripe_customer_id) return { erreur: "Ton abonnement est introuvable. Écris-moi, je regarde tout de suite." };
  let url: string;
  try {
    url = await creerSessionPortail(fiche.stripe_customer_id, `${SITE_URL()}/espace/profil`);
  } catch {
    return { erreur: "L’espace de gestion ne s’ouvre pas pour le moment. Réessaie dans un instant." };
  }
  redirect(url);
}

/** Consentement de l'abonnée (même version que les clientes coachées, texte adapté). */
export async function accepterConsentementAbonnee(formData: FormData) {
  if (formData.get("accord") !== "oui") redirect("/espace/bienvenue?manque=1");
  const { supabase, profil, reglages } = await exigerAbonnee(false);
  const { error } = await supabase
    .from("consentements")
    .upsert({ cliente_id: profil.id, version: reglages.version_consentement }, { onConflict: "cliente_id,version", ignoreDuplicates: true });
  if (error) redirect("/espace/bienvenue?erreur=1");
  redirect("/espace");
}

export type EtatMetabolisme = { erreur?: string; succes?: string };

/** « Mon métabolisme » : ses données, gardées pour elle seule (la coach n'y a pas accès). */
export async function enregistrerMetabolisme(_e: EtatMetabolisme, formData: FormData): Promise<EtatMetabolisme> {
  const { supabase, profil } = await exigerAbonnee();
  const champ = (n: string) => String(formData.get(n) ?? "");
  const r = lireFormulaireMetabolisme(
    { annee_naissance: champ("annee_naissance"), taille_cm: champ("taille_cm"), poids_kg: champ("poids_kg"), activite: champ("activite") },
    new Date().getFullYear(),
  );
  if (!r.valeurs) return { erreur: r.erreur };
  const { error } = await supabase.from("metabolisme").upsert({ cliente_id: profil.id, ...r.valeurs, maj_le: new Date().toISOString() }, { onConflict: "cliente_id" });
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie dans un instant." };
  revalidatePath("/espace/metabolisme");
  revalidatePath("/espace");
  return { succes: "C’est noté ✓" };
}

/** Mode sans chiffres (poids masqué partout) : l'abonnée le choisit elle-même. */
export async function definirSansChiffresAbonnee(actif: boolean): Promise<EtatEspace> {
  const { supabase } = await exigerAbonnee();
  const { error } = await supabase.rpc("definir_sans_chiffres_abonnee", { p_actif: actif === true });
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie dans un instant." };
  revalidatePath("/espace", "layout");
  return {};
}

/**
 * « Ajouter le menu à ma liste de courses » : toutes les recettes du menu (1 portion × portions),
 * additionnées par aliment et rangées par rayon. Si le menu était déjà dans la liste, il est remplacé.
 */
export async function ajouterMenuAuxCourses(lundi: string, portions: number): Promise<EtatEspace & { succes?: string }> {
  const { supabase, profil } = await exigerAbonnee();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lundi)) return { erreur: "Menu introuvable." };
  const p = Math.round(Number(portions));
  if (!Number.isInteger(p) || p < 1 || p > 6) return { erreur: "Choisis entre 1 et 6 personnes." };
  const { data: menu } = await supabase.from("menus_semaine").select("id").eq("lundi", lundi).eq("publie", true).maybeSingle<{ id: string }>();
  if (!menu) return { erreur: "Ce menu n’est plus disponible." };
  const [{ data: cases }, recettes] = await Promise.all([
    supabase.from("menus_repas").select("jour, repas, recette_id").eq("menu_id", menu.id).returns<CaseMenu[]>(),
    chargerRecettes(supabase),
  ]);
  const total = quantitesDuMenu(cases ?? [], recettes, p);
  if (!total.length) return { erreur: "Ce menu est vide pour le moment." };
  const { data: aliments } = await supabase.from("aliments").select("id, nom, groupe, sous_groupe").in("id", total.map((l) => l.aliment_id));
  const groupes = new Map((aliments ?? []).map((a) => [a.id as string, a]));
  const titre = titreLotMenu(lundi);
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
        portions: p,
        aliment_id: l.aliment_id,
        nom: nomCourt(l.nom),
        rayon: rayonPour(g?.groupe ?? null, g?.sous_groupe ?? null, [], l.nom),
        quantite: l.quantite,
        unite: l.unite,
        nom_unite: l.nom_unite,
      };
    }),
  );
  if (error) return { erreur: error.code === "23514" ? "Ta liste de courses est pleine : retire quelques articles d’abord." : "L’ajout a échoué. Réessaie." };
  revalidatePath("/espace/recettes/courses");
  return { succes: `${total.length} article${total.length > 1 ? "s" : ""} ajouté${total.length > 1 ? "s" : ""} à ta liste de courses ✓` };
}
