"use server";

import { revalidatePath } from "next/cache";
import { aujourdhuiParis } from "@/lib/bilan";
import { lireSaisiePaiement, sauverPaiement } from "@/lib/paiements-serveur";
import { SESSION_PERDUE, UUID, sessionCoach, verifierCliente } from "./verification";
import type { EtatAction } from "./actions";

export async function enregistrerPaiement(clienteId: string, _e: EtatAction, formData: FormData): Promise<EtatAction> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };
  const { erreur, saisie } = lireSaisiePaiement(formData);
  if (erreur) return { erreur };
  const ok = await sauverPaiement(v.supabase, clienteId, saisie);
  if (!ok) return { erreur: "L’enregistrement a échoué. As-tu fait la mise à jour 0010 dans Supabase ?" };
  revalidatePath(`/coach/clientes/${clienteId}`);
  revalidatePath("/coach");
  return { succes: "Formule et paiement enregistrés." };
}

/** Coche (ou décoche) une échéance comme payée. */
export async function basculerEcheance(id: string, payee: boolean): Promise<EtatAction> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(String(id))) return { erreur: "Échéance introuvable." };
  const { data, error } = await session.supabase
    .from("echeances_paiement")
    .update({ payee_le: payee ? aujourdhuiParis() : null })
    .eq("id", id)
    .select("cliente_id")
    .maybeSingle<{ cliente_id: string }>();
  if (error || !data) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  revalidatePath(`/coach/clientes/${data.cliente_id}`);
  revalidatePath("/coach");
  return {};
}
