"use server";

import { revalidatePath } from "next/cache";
import { SESSION_PERDUE, UUID, sessionCoach } from "../clientes/verification";
import { texteAnonymiseDuBilan } from "@/lib/bilan-claude-serveur";
import { brouillonConfigure, proposerBrouillon } from "@/lib/brouillon-claude";

export type EtatRetour = { erreur?: string; succes?: string };

export async function enregistrerRetour(bilanId: string, _e: EtatRetour, formData: FormData): Promise<EtatRetour> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(bilanId)) return { erreur: "Bilan introuvable." };
  const contenu = String(formData.get("contenu") ?? "").trim().slice(0, 5000);
  if (!contenu) return { erreur: "Écris ton retour avant de l’envoyer." };

  const { data: bilan } = await session.supabase.from("bilans").select("cliente_id").eq("id", bilanId).maybeSingle();
  if (!bilan) return { erreur: "Bilan introuvable." };

  // Un retour modifié redevient « non lu » pour la cliente.
  const { error } = await session.supabase
    .from("retours_bilan")
    .upsert({ bilan_id: bilanId, contenu, lu_le: null }, { onConflict: "bilan_id" });
  if (error) return { erreur: "Le retour n’a pas pu être envoyé." };

  revalidatePath("/coach/bilans");
  revalidatePath("/coach");
  revalidatePath(`/coach/bilans/${bilanId}`);
  revalidatePath(`/coach/clientes/${bilan.cliente_id}/suivi`);
  revalidatePath("/suivi");
  return { succes: "Retour envoyé. Elle le verra à sa prochaine ouverture de l’app." };
}

/**
 * Brouillon de réponse par Claude (si la coach l'a activé et que la clé est configurée).
 * Le texte envoyé est recalculé ici, sur le serveur : c'est exactement le texte anonymisé de « Copier pour Claude ».
 * Le prénom ne quitte jamais le serveur : il remplace « [prénom] » dans le brouillon renvoyé à la coach.
 */
export async function proposerBrouillonRetour(bilanId: string): Promise<{ texte?: string; erreur?: string }> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(bilanId)) return { erreur: "Bilan introuvable." };
  const { data: reglage } = await session.supabase.from("reglages").select("brouillon_claude").maybeSingle<{ brouillon_claude: boolean }>();
  if (!reglage?.brouillon_claude || !brouillonConfigure()) return { erreur: "Les brouillons Claude ne sont pas activés (Réglages)." };
  const anonyme = await texteAnonymiseDuBilan(session.supabase, bilanId);
  if (!anonyme) return { erreur: "Bilan introuvable." };
  const r = await proposerBrouillon(anonyme.texte);
  if ("erreur" in r) return r;
  return { texte: r.texte.replaceAll("[prénom]", anonyme.prenom || "toi") };
}
