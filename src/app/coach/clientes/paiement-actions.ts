"use server";

import { revalidatePath } from "next/cache";
import { lireSaisiePaiement, sauverPaiement } from "@/lib/paiements-serveur";
import { verifierCliente } from "./verification";
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
