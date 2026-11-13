"use server";

import { revalidatePath } from "next/cache";
import { lireSession } from "@/lib/auth";
import { nettoyerTexte } from "@/lib/communaute";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type EtatModeration = { erreur?: string; succes?: string };

async function coach() {
  const s = await lireSession();
  return s && s.profil.role === "coach" ? s : null;
}

function rafraichir() {
  revalidatePath("/coach/communaute");
  revalidatePath("/coach", "layout");
  revalidatePath("/communaute");
  revalidatePath("/");
}

export async function epinglerMessage(id: string, epingle: boolean): Promise<EtatModeration> {
  const s = await coach();
  if (!s) return { erreur: "Réservé à la coach." };
  if (!UUID.test(String(id))) return { erreur: "Message introuvable." };
  const { error } = await s.supabase.from("messages_communaute").update({ epingle: epingle === true }).eq("id", id);
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  rafraichir();
  return {};
}

export async function enregistrerCommunaute(_e: EtatModeration, formData: FormData): Promise<EtatModeration> {
  const s = await coach();
  if (!s) return { erreur: "Réservé à la coach." };
  const ouverte = formData.get("ouverte") === "on";
  const charte = nettoyerTexte(String(formData.get("charte") ?? "")).slice(0, 3000);
  if (!charte) return { erreur: "La charte ne peut pas être vide." };
  const { error } = await s.supabase
    .from("reglages")
    .update({ communaute_ouverte: ouverte, communaute_charte: charte })
    .eq("id", true);
  if (error) return { erreur: "L’enregistrement a échoué. Réessaie." };
  rafraichir();
  return { succes: ouverte ? "Enregistré : la communauté est ouverte." : "Enregistré : la communauté est fermée." };
}

/** Retirer (la cliente ne peut plus revenir seule), réintégrer, ou effacer l'adhésion. */
export async function changerMembre(clienteId: string, action: "retirer" | "reintegrer" | "effacer"): Promise<EtatModeration> {
  const s = await coach();
  if (!s) return { erreur: "Réservé à la coach." };
  if (!UUID.test(String(clienteId))) return { erreur: "Cliente introuvable." };
  const requete =
    action === "effacer"
      ? s.supabase.from("membres_communaute").delete().eq("cliente_id", clienteId)
      : action === "retirer" || action === "reintegrer"
        ? s.supabase
            .from("membres_communaute")
            .update({ statut: action === "retirer" ? "exclue" : "membre" })
            .eq("cliente_id", clienteId)
        : null;
  if (!requete) return { erreur: "Action inconnue." };
  const { error } = await requete;
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  rafraichir();
  return {};
}

export async function traiterSignalements(messageId: string): Promise<EtatModeration> {
  const s = await coach();
  if (!s) return { erreur: "Réservé à la coach." };
  if (!UUID.test(String(messageId))) return { erreur: "Message introuvable." };
  const { error } = await s.supabase.from("signalements_communaute").update({ traite: true }).eq("message_id", messageId);
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  rafraichir();
  return {};
}
