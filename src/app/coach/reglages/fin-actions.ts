"use server";

import { revalidatePath } from "next/cache";
import { SESSION_PERDUE, sessionCoach } from "../clientes/verification";

export type EtatFin = { erreur?: string; succes?: string };

/** Texte et offres du bloc « Continuer avec moi » (bilan de fin de suivi). Pas de prix imposé : c'est la coach qui écrit. */
export async function enregistrerFinSuivi(_e: EtatFin, formData: FormData): Promise<EtatFin> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const texte = String(formData.get("fin_texte") ?? "").trim();
  if (!texte || texte.length > 1500) return { erreur: "Écris un petit texte (1 500 caractères au plus)." };
  const titres = formData.getAll("offre_titre").map((t) => String(t).trim());
  const descriptions = formData.getAll("offre_description").map((t) => String(t).trim());
  const offres = titres
    .map((titre, i) => ({ titre: titre.slice(0, 120), description: (descriptions[i] ?? "").slice(0, 500) }))
    .filter((o) => o.titre);
  if (new Set(offres.map((o) => o.titre)).size !== offres.length) return { erreur: "Deux offres ont le même titre : change l’un des deux." };
  if (offres.length > 6) return { erreur: "6 offres au plus." };
  const { error } = await session.supabase.from("reglages").update({ fin_texte: texte, fin_offres: offres }).eq("id", true);
  if (error) return { erreur: "L’enregistrement a échoué. As-tu fait la mise à jour 0038 ?" };
  revalidatePath("/coach/reglages");
  return { succes: "Enregistré ✓" };
}

/** Marque une demande « continuer avec moi » comme traitée (elle disparaît du tableau de bord). */
export async function traiterDemandeSuite(id: string): Promise<EtatFin> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { erreur: "Demande introuvable." };
  const { data, error } = await session.supabase.from("demandes_suite").update({ traitee: true }).eq("id", id).select("cliente_id").maybeSingle();
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  revalidatePath("/coach");
  if (data?.cliente_id) revalidatePath(`/coach/clientes/${data.cliente_id}`);
  return { succes: "Marquée comme traitée." };
}
