"use server";

import { revalidatePath } from "next/cache";
import { SESSION_PERDUE, UUID, sessionCoach } from "../clientes/verification";

export type EtatAvisCoach = { erreur?: string; succes?: string };

/** La coach retire un témoignage (elle ne peut jamais en modifier le texte ni l'autorisation). */
export async function supprimerAvisCoach(id: string): Promise<EtatAvisCoach> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(id)) return { erreur: "Témoignage introuvable." };
  const { error } = await session.supabase.from("avis").delete().eq("id", id);
  if (error) return { erreur: "La suppression a échoué." };
  revalidatePath("/coach/avis");
  return { succes: "Témoignage supprimé." };
}

/** Récompense de parrainage donnée (gérée à la main par la coach). */
export async function marquerRecompense(demandeId: string, donnee: boolean): Promise<EtatAvisCoach> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(demandeId)) return { erreur: "Inscription introuvable." };
  const { data, error } = await session.supabase
    .from("demandes_inscription")
    .update({ recompense_donnee: donnee })
    .eq("id", demandeId)
    .select("marraine_id")
    .maybeSingle();
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  if (data?.marraine_id) revalidatePath(`/coach/clientes/${data.marraine_id}`);
  return { succes: donnee ? "Récompense notée ✓" : "Récompense retirée." };
}

/** Lien du formulaire d'inscription (pour les liens de parrainage des clientes). */
export async function enregistrerLienInscription(_e: EtatAvisCoach, formData: FormData): Promise<EtatAvisCoach> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const brut = String(formData.get("lien_inscription") ?? "").trim();
  let lien: string | null = null;
  if (brut) {
    try {
      const u = new URL(brut);
      if (u.protocol !== "https:") throw new Error();
      lien = u.toString();
    } catch {
      return { erreur: "Le lien doit commencer par https://" };
    }
  }
  const { error } = await session.supabase.from("reglages").update({ lien_inscription: lien }).eq("id", true);
  if (error) return { erreur: "L’enregistrement a échoué. As-tu fait la mise à jour 0039 ?" };
  revalidatePath("/coach/reglages");
  return { succes: "Enregistré ✓" };
}
