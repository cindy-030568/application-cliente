"use server";

import { revalidatePath } from "next/cache";
import { SESSION_PERDUE, UUID, sessionCoach } from "../clientes/verification";

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
