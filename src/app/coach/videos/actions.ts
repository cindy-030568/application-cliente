"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FamilleFiltre } from "@/lib/types";
import { idYoutube } from "@/lib/youtube";
import { SESSION_PERDUE, UUID, sessionCoach } from "../clientes/verification";

export type EtatVideo = { erreur?: string; succes?: string };

function rafraichir() {
  revalidatePath("/coach/videos", "layout");
  revalidatePath("/sport", "layout");
}

function lignes(brut: FormDataEntryValue | null, max = 12): string[] {
  return String(brut ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*\s]+/, "").trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, max);
}

export async function enregistrerVideo(id: string | null, _e: EtatVideo, formData: FormData): Promise<EtatVideo> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const { supabase } = session;

  const titre = String(formData.get("titre") ?? "").trim().slice(0, 120);
  if (!titre) return { erreur: "Le titre est obligatoire." };
  const youtube_id = idYoutube(String(formData.get("lien") ?? ""));
  if (!youtube_id) return { erreur: "Ce lien YouTube n’est pas reconnu. Copie le lien depuis le bouton « Partager » de la vidéo." };

  const valeurs = {
    titre,
    youtube_id,
    description: String(formData.get("description") ?? "").trim().slice(0, 600) || null,
    points_cles: lignes(formData.get("points_cles")),
    erreurs: lignes(formData.get("erreurs")),
    publiee: formData.get("publiee") === "on",
  };
  const filtres = formData.getAll("filtres").map(String).filter((f) => UUID.test(f));

  let videoId = id;
  if (id) {
    if (!UUID.test(id)) return { erreur: "Vidéo introuvable." };
    const { error } = await supabase.from("videos").update(valeurs).eq("id", id);
    if (error) return { erreur: "L’enregistrement a échoué." };
  } else {
    const { data, error } = await supabase.from("videos").insert(valeurs).select("id").single();
    if (error || !data) return { erreur: "L’enregistrement a échoué." };
    videoId = data.id as string;
  }

  await supabase.from("videos_filtres").delete().eq("video_id", videoId);
  if (filtres.length) {
    const { error } = await supabase
      .from("videos_filtres")
      .insert(filtres.map((filtre_id) => ({ video_id: videoId, filtre_id })));
    if (error) return { erreur: "La vidéo est enregistrée, mais pas ses filtres." };
  }
  rafraichir();
  if (!id) redirect(`/coach/videos?ajoutee=1`);
  return { succes: "Modifications enregistrées." };
}

export async function supprimerVideo(id: string): Promise<EtatVideo> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(id)) return { erreur: "Vidéo introuvable." };
  const { error } = await session.supabase.from("videos").delete().eq("id", id);
  if (error) return { erreur: "La suppression a échoué." };
  rafraichir();
  redirect("/coach/videos?supprimee=1");
}

export async function ajouterFiltre(famille: FamilleFiltre, nom: string): Promise<EtatVideo> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const propre = nom.trim().slice(0, 40);
  if (!["groupe", "materiel", "categorie"].includes(famille) || !propre) return { erreur: "Nom invalide." };
  const { data: max } = await session.supabase
    .from("filtres_video")
    .select("ordre")
    .eq("famille", famille)
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await session.supabase
    .from("filtres_video")
    .insert({ famille, nom: propre, ordre: (max?.ordre ?? 0) + 1 });
  if (error) return { erreur: "Ce filtre existe déjà." };
  rafraichir();
  return {};
}

export async function renommerFiltre(id: string, nom: string): Promise<EtatVideo> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const propre = nom.trim().slice(0, 40);
  if (!UUID.test(id) || !propre) return { erreur: "Nom invalide." };
  const { error } = await session.supabase.from("filtres_video").update({ nom: propre }).eq("id", id);
  if (error) return { erreur: "Ce nom est déjà utilisé." };
  rafraichir();
  return {};
}

export async function supprimerFiltre(id: string): Promise<EtatVideo> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(id)) return { erreur: "Filtre introuvable." };
  const { error } = await session.supabase.from("filtres_video").delete().eq("id", id);
  if (error) return { erreur: "La suppression a échoué." };
  rafraichir();
  return {};
}
