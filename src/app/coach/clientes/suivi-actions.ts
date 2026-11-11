"use server";

import { revalidatePath } from "next/cache";
import { heureParisVersIso } from "@/lib/bilan";
import { verifierCliente } from "./verification";

export type EtatSuivi = { erreur?: string; succes?: string };

export async function reglerSuivi(clienteId: string, _e: EtatSuivi, formData: FormData): Promise<EtatSuivi> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };

  const rdvBrut = String(formData.get("prochain_rdv") ?? "").trim();
  const prochain_rdv = rdvBrut ? heureParisVersIso(rdvBrut) : null;
  if (rdvBrut && !prochain_rdv) return { erreur: "La date du rendez-vous n’est pas valide." };

  const lienBrut = String(formData.get("lien_rdv") ?? "").trim();
  let lien_rdv: string | null = null;
  if (lienBrut) {
    try {
      const u = new URL(lienBrut);
      if (u.protocol !== "https:") throw new Error();
      lien_rdv = u.toString();
    } catch {
      return { erreur: "Le lien de visio doit commencer par https://" };
    }
  }

  const { error } = await v.supabase
    .from("clientes")
    .update({
      mode_sans_chiffres: formData.get("mode_sans_chiffres") === "on",
      masquer_graph_poids: formData.get("masquer_graph_poids") === "on",
      prochain_rdv,
      lien_rdv,
    })
    .eq("id", clienteId);
  if (error) return { erreur: "L’enregistrement a échoué." };
  revalidatePath(`/coach/clientes/${clienteId}`, "layout");
  revalidatePath("/", "layout");
  return { succes: "Réglages du suivi enregistrés." };
}
