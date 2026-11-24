"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { envoyerPushCliente } from "@/lib/envoi-rappels";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifierCliente } from "./clientes/verification";

export type EtatMessage = { erreur?: string; succes?: string };

const MIGRATION = "Fais d’abord la mise à jour de la base : fichier 0023_messages_cliente.sql (voir le guide).";

/**
 * Proposition de message de l'accueil : envoyée dans l'appli (notification + « Un petit mot de ma part » sur son accueil),
 * copiée (envoyée par toi ailleurs) ou ignorée. Dans tous les cas, elle ne revient pas cette semaine.
 */
export async function traiterProposition(clienteId: string, proposition: string, statut: "envoye" | "copie" | "ignore", texte: string): Promise<EtatMessage> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };
  if (!["envoye", "copie", "ignore"].includes(statut) || !/^[a-z_]+:\d{4}-W\d{2}$/.test(proposition)) return { erreur: "Proposition inconnue." };
  const t = texte.trim().slice(0, 1000);
  if (statut === "envoye" && !t) return { erreur: "Écris d’abord ton message." };
  const { error } = await v.supabase.from("messages_cliente").insert({ cliente_id: clienteId, proposition, statut, texte: statut === "ignore" ? null : t });
  if (error) return { erreur: ["42P01", "PGRST205"].includes(error.code) ? MIGRATION : "Ça n’a pas fonctionné. Réessaie." };
  if (statut === "envoye") {
    after(async () => {
      try {
        await envoyerPushCliente(createAdminClient(), clienteId, { titre: "Un petit mot pour toi 💛", texte: t.length > 140 ? `${t.slice(0, 137)}…` : t, url: "/" });
      } catch {
        // le message reste visible sur son accueil même si la notification échoue
      }
    });
  }
  revalidatePath("/coach");
  revalidatePath(`/coach/clientes/${clienteId}`);
  return { succes: statut === "envoye" ? `Envoyé à ${v.prenom} 💌` : statut === "copie" ? "Copié : colle-le dans ta messagerie." : "Proposition ignorée." };
}
