"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { lireSession } from "@/lib/auth";
import { estReaction, nettoyerTexte, photoDe, type MessageCommunaute } from "@/lib/communaute";
import { chargerMessages, lireEtatCommunaute, notifierMembres } from "@/lib/communaute-serveur";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_EXPIREE = "Ta session a expiré. Reconnecte-toi, puis réessaie.";
export type EtatCommunauteAction = { erreur?: string; succes?: string };

function rafraichir() {
  revalidatePath("/communaute");
  revalidatePath("/");
  revalidatePath("/coach/communaute");
}

async function session() {
  const s = await lireSession();
  return s ? { ...s, coach: s.profil.role === "coach" } : null;
}

// ---------------------------------------------------------------- Adhésion

export async function rejoindreCommunaute(_e: EtatCommunauteAction, formData: FormData): Promise<EtatCommunauteAction> {
  const s = await session();
  if (!s || s.coach) return { erreur: SESSION_EXPIREE };
  if (formData.get("charte") !== "on") return { erreur: "Coche la case pour accepter la charte." };
  const etat = await lireEtatCommunaute(s.supabase);
  if (!etat?.ouverte) return { erreur: "La communauté n’est pas ouverte pour le moment." };
  const { error } = await s.supabase.from("membres_communaute").insert({ cliente_id: s.profil.id });
  if (error) return { erreur: "Tu ne peux pas rejoindre la communauté pour le moment. Parles-en à Cindy." };
  rafraichir();
  return {};
}

export async function quitterCommunaute(): Promise<EtatCommunauteAction> {
  const s = await session();
  if (!s || s.coach) return { erreur: SESSION_EXPIREE };
  await s.supabase.from("membres_communaute").delete().eq("cliente_id", s.profil.id);
  rafraichir();
  return {};
}

export async function definirNotificationsCommunaute(actif: boolean): Promise<EtatCommunauteAction> {
  const s = await session();
  if (!s || s.coach) return { erreur: SESSION_EXPIREE };
  const { error } = await s.supabase.rpc("reglages_membre", { p_notifications: actif === true, p_vu: false });
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  revalidatePath("/communaute");
  return {};
}

// ---------------------------------------------------------------- Fil

/** Recharge le fil (sans `avant`) ou une page plus ancienne. Note la visite. */
export async function chargerFil(
  avant: string | null,
  limite?: number,
): Promise<{ erreur?: string; messages?: MessageCommunaute[]; encore?: boolean; maintenant?: string }> {
  const s = await session();
  if (!s) return { erreur: SESSION_EXPIREE };
  if (avant !== null && (typeof avant !== "string" || Number.isNaN(Date.parse(avant)))) return { erreur: "Page introuvable." };
  const r = await chargerMessages(s.supabase, s.profil.id, { avant, limite: Number(limite) || undefined });
  if (!avant && !s.coach) await s.supabase.rpc("reglages_membre", { p_vu: true });
  return { ...r, maintenant: new Date().toISOString() };
}

export async function preparerPhotoCommunaute(): Promise<{ erreur?: string; chemin?: string; jeton?: string }> {
  const s = await session();
  if (!s) return { erreur: SESSION_EXPIREE };
  const chemin = `${s.profil.id}/${randomUUID()}.jpg`;
  const { data, error } = await s.supabase.storage.from("communaute").createSignedUploadUrl(chemin);
  if (error || !data) return { erreur: "L’envoi de la photo n’a pas pu être préparé." };
  return { chemin: data.path, jeton: data.token };
}

export async function publierMessage(texteBrut: string, chemin: string | null): Promise<EtatCommunauteAction> {
  const s = await session();
  if (!s) return { erreur: SESSION_EXPIREE };
  const texte = nettoyerTexte(String(texteBrut ?? ""));
  const photo = chemin ? String(chemin) : null;
  if (photo && !photoDe(photo, s.profil.id)) return { erreur: "Photo introuvable." };
  if (!texte && !photo) return { erreur: "Écris un message ou ajoute une photo." };
  const { error } = await s.supabase.from("messages_communaute").insert({ texte, photo_path: photo });
  if (error) {
    if (photo) await s.supabase.storage.from("communaute").remove([photo]);
    return {
      erreur: error.message.includes("Trop de messages")
        ? "Tu as envoyé beaucoup de messages : patiente un peu avant le prochain."
        : "Ton message n’a pas pu être publié. Réessaie.",
    };
  }
  const auteur = s.profil.id;
  after(() => notifierMembres(auteur));
  rafraichir();
  return {};
}

/** Supprime un message (le sien ; la coach peut supprimer n'importe lequel). */
export async function supprimerMessage(id: string): Promise<EtatCommunauteAction> {
  const s = await session();
  if (!s) return { erreur: SESSION_EXPIREE };
  if (!UUID.test(String(id))) return { erreur: "Message introuvable." };
  const { data, error } = await s.supabase
    .from("messages_communaute")
    .delete()
    .eq("id", id)
    .select("photo_path")
    .maybeSingle<{ photo_path: string | null }>();
  if (error || !data) return { erreur: "Ce message ne peut pas être supprimé." };
  if (data.photo_path) await s.supabase.storage.from("communaute").remove([data.photo_path]);
  rafraichir();
  return {};
}

export async function reagir(id: string, reaction: string, actif: boolean): Promise<EtatCommunauteAction> {
  const s = await session();
  if (!s) return { erreur: SESSION_EXPIREE };
  if (!UUID.test(String(id)) || !estReaction(reaction)) return { erreur: "Réaction impossible." };
  if (actif) {
    const { error } = await s.supabase.from("reactions_communaute").insert({ message_id: id, emoji: reaction });
    if (error && error.code !== "23505") return { erreur: "Réaction impossible pour le moment." };
  } else {
    await s.supabase
      .from("reactions_communaute")
      .delete()
      .eq("message_id", id)
      .eq("auteur_id", s.profil.id)
      .eq("emoji", reaction);
  }
  return {};
}

export async function signalerMessage(id: string, motifBrut: string): Promise<EtatCommunauteAction> {
  const s = await session();
  if (!s || s.coach) return { erreur: SESSION_EXPIREE };
  if (!UUID.test(String(id))) return { erreur: "Message introuvable." };
  const motif = nettoyerTexte(String(motifBrut ?? "")).slice(0, 300) || null;
  const { error } = await s.supabase.from("signalements_communaute").insert({ message_id: id, motif });
  if (error && error.code !== "23505") return { erreur: "Le signalement n’a pas pu être envoyé. Réessaie." };
  revalidatePath("/coach/communaute");
  revalidatePath("/coach", "layout");
  return { succes: "Merci, Cindy a été prévenue. Elle regardera ce message." };
}
