"use server";

import { revalidatePath } from "next/cache";
import { SESSION_PERDUE, UUID, sessionCoach } from "../clientes/verification";

export type EtatRessource = { erreur?: string; succes?: string };

function rafraichir() {
  revalidatePath("/coach/ressources");
  revalidatePath("/ressources");
}

export async function enregistrerRessource(
  _e: EtatRessource,
  formData: FormData,
): Promise<EtatRessource> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const { supabase } = session;

  const id = String(formData.get("id") ?? "");
  const titre = String(formData.get("titre") ?? "").trim().slice(0, 120);
  const description = String(formData.get("description") ?? "").trim().slice(0, 500) || null;
  const categorie = String(formData.get("categorie_id") ?? "");
  const visibilite = formData.get("visibilite") === "certaines" ? "certaines" : "toutes";
  const clientes = formData.getAll("clientes").map(String).filter((c) => UUID.test(c));

  if (!titre) return { erreur: "Le titre est obligatoire." };
  let url: string;
  try {
    const u = new URL(String(formData.get("url") ?? "").trim());
    if (u.protocol !== "https:") throw new Error();
    url = u.toString();
  } catch {
    return { erreur: "Le lien doit commencer par https://" };
  }
  if (visibilite === "certaines" && clientes.length === 0) {
    return { erreur: "Choisis au moins une cliente, ou rends la ressource visible par toutes." };
  }

  const valeurs = {
    titre,
    description,
    url,
    visibilite,
    categorie_id: UUID.test(categorie) ? categorie : null,
  };

  let ressourceId = id;
  if (id) {
    if (!UUID.test(id)) return { erreur: "Ressource introuvable." };
    const { error } = await supabase.from("ressources").update(valeurs).eq("id", id);
    if (error) return { erreur: "L’enregistrement a échoué." };
  } else {
    const { data, error } = await supabase.from("ressources").insert(valeurs).select("id").single();
    if (error || !data) return { erreur: "L’enregistrement a échoué." };
    ressourceId = data.id;
  }

  await supabase.from("ressources_clientes").delete().eq("ressource_id", ressourceId);
  if (visibilite === "certaines") {
    const { error } = await supabase
      .from("ressources_clientes")
      .insert(clientes.map((cliente_id) => ({ ressource_id: ressourceId, cliente_id })));
    if (error) return { erreur: "La ressource est enregistrée, mais pas le choix des clientes." };
  }

  rafraichir();
  return { succes: id ? "Ressource modifiée." : "Ressource ajoutée." };
}

export async function supprimerRessource(id: string): Promise<EtatRessource> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(id)) return { erreur: "Ressource introuvable." };
  const { error } = await session.supabase.from("ressources").delete().eq("id", id);
  if (error) return { erreur: "La suppression a échoué." };
  rafraichir();
  return { succes: "Ressource supprimée." };
}

export async function ajouterCategorie(_e: EtatRessource, formData: FormData): Promise<EtatRessource> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const nom = String(formData.get("nom") ?? "").trim().slice(0, 60);
  if (!nom) return { erreur: "Donne un nom à la catégorie." };
  const { data: max } = await session.supabase
    .from("categories_ressource")
    .select("ordre")
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await session.supabase
    .from("categories_ressource")
    .insert({ nom, ordre: (max?.ordre ?? 0) + 1 });
  if (error) return { erreur: "Cette catégorie existe déjà." };
  rafraichir();
  return { succes: "Catégorie ajoutée." };
}

export async function renommerCategorie(id: string, nom: string): Promise<EtatRessource> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const propre = nom.trim().slice(0, 60);
  if (!UUID.test(id) || !propre) return { erreur: "Nom invalide." };
  const { error } = await session.supabase.from("categories_ressource").update({ nom: propre }).eq("id", id);
  if (error) return { erreur: "Ce nom est déjà utilisé." };
  rafraichir();
  return {};
}

export async function supprimerCategorie(id: string): Promise<EtatRessource> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(id)) return { erreur: "Catégorie introuvable." };
  const { error } = await session.supabase.from("categories_ressource").delete().eq("id", id);
  if (error) return { erreur: "La suppression a échoué." };
  rafraichir();
  return { succes: "Catégorie supprimée (ses ressources passent dans « Autres »)." };
}
