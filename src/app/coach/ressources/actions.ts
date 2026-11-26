"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { CHEMIN_AUDIO } from "@/lib/ressources";
import { SESSION_PERDUE, UUID, sessionCoach } from "../clientes/verification";

export type EtatRessource = { erreur?: string; succes?: string };

function rafraichir() {
  revalidatePath("/coach/ressources");
  revalidatePath("/ressources");
  revalidatePath("/espace/ressources");
}

/** Étape 1 du dépôt d'un audio : autorisation d'envoi direct vers le stockage privé « audios ». */
export async function preparerDepotAudio(ext: string): Promise<{ erreur?: string; chemin?: string; jeton?: string }> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!["m4a", "mp3", "webm"].includes(ext)) return { erreur: "Format non accepté : m4a ou mp3." };
  const { data, error } = await session.supabase.storage.from("audios").createSignedUploadUrl(`${randomUUID()}.${ext}`);
  if (error || !data) return { erreur: "Le dépôt n’a pas pu être préparé. As-tu fait la mise à jour 0043 ? Sinon, réessaie dans un instant." };
  return { chemin: data.path, jeton: data.token };
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
  // Fiches écrites dans l'appli et brouillons : seulement après la mise à jour 0037 ; audios après 0043.
  const avecFiches = formData.get("avec_fiches") === "1";
  const avecAudio = formData.get("avec_audio") === "1";
  const avecAbonnees = formData.get("avec_abonnees") === "1";
  const type = String(formData.get("type") ?? "lien");
  const fiche = avecFiches && type === "fiche";
  const audioSeul = avecAudio && type === "audio";
  // Audio : un nouveau fichier déposé (chemin vérifié), ou on garde / retire l'actuel.
  const nouvelAudio = String(formData.get("audio_path") ?? "");
  if (nouvelAudio && !CHEMIN_AUDIO.test(nouvelAudio)) return { erreur: "L’audio est introuvable. Recommence le dépôt." };
  const duree = Math.round(Number(formData.get("audio_duree")));
  const retirerAudio = formData.get("retirer_audio") === "on";
  let ancienAudio: string | null = null;
  if (avecAudio && id && UUID.test(id)) {
    const { data } = await supabase.from("ressources").select("audio_path").eq("id", id).maybeSingle<{ audio_path: string | null }>();
    ancienAudio = data?.audio_path ?? null;
  }
  const audioFinal = nouvelAudio || (retirerAudio ? null : ancienAudio);
  if (audioSeul && !audioFinal) return { erreur: "Ajoute le fichier audio (m4a ou mp3), ou enregistre-le ici." };
  let url: string | null = null;
  let contenu: string | null = null;
  if (audioSeul) {
    // Audio seul : ni lien ni texte.
  } else if (fiche) {
    contenu = String(formData.get("contenu") ?? "").replace(/\r\n?/g, "\n").trim();
    if (!contenu) return { erreur: "Écris le contenu de la fiche." };
    if (contenu.length > 20000) return { erreur: "La fiche est trop longue (20 000 caractères au plus)." };
  } else {
    try {
      const u = new URL(String(formData.get("url") ?? "").trim());
      if (u.protocol !== "https:") throw new Error();
      url = u.toString();
    } catch {
      return { erreur: "Le lien doit commencer par https://" };
    }
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
    ...(avecFiches ? { contenu, publiee: formData.get("publiee") === "on" } : {}),
    ...(avecAbonnees ? { pour_abonnees: formData.get("pour_abonnees") === "on" } : {}),
    ...(avecAudio
      ? {
          audio_path: audioFinal,
          ...(nouvelAudio ? { audio_duree: duree >= 1 && duree <= 36000 ? duree : null } : audioFinal ? {} : { audio_duree: null }),
        }
      : {}),
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

  // L'ancien fichier audio remplacé ou retiré est effacé du stockage.
  if (ancienAudio && ancienAudio !== audioFinal) await supabase.storage.from("audios").remove([ancienAudio]);

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
  const { data: audio } = await session.supabase.from("ressources").select("audio_path").eq("id", id).maybeSingle<{ audio_path: string | null }>();
  const { error } = await session.supabase.from("ressources").delete().eq("id", id);
  if (error) return { erreur: "La suppression a échoué." };
  if (audio?.audio_path) await session.supabase.storage.from("audios").remove([audio.audio_path]);
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
