"use server";

import { revalidatePath } from "next/cache";
import { CODES_MOMENTS } from "@/lib/complements";
import { UUID, verifierCliente } from "./verification";

export type EtatComplement = { erreur?: string; succes?: string };

const MIGRATION = "Fais d’abord la mise à jour de la base : fichier 0035_complements.sql (voir le guide).";
const erreurBase = (code?: string) => (["42P01", "PGRST205"].includes(code ?? "") ? MIGRATION : "Ça n’a pas fonctionné. Réessaie.");

function lire(formData: FormData) {
  const nom = String(formData.get("nom") ?? "").trim();
  const quantite = String(formData.get("quantite") ?? "").trim();
  const moment = String(formData.get("moment") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!nom || nom.length > 80) return { erreur: "Indique le nom du complément (80 caractères au plus)." } as const;
  if (!quantite || quantite.length > 80) return { erreur: "Indique combien en prendre (ex. « 2 gélules »)." } as const;
  if (!CODES_MOMENTS.includes(moment)) return { erreur: "Choisis quand le prendre." } as const;
  if (note.length > 300) return { erreur: "La précision est trop longue (300 caractères au plus)." } as const;
  return { ligne: { nom, quantite, moment, note: note || null } } as const;
}

/** Ajoute un complément à la liste d'une cliente. */
export async function ajouterComplement(clienteId: string, _e: EtatComplement, formData: FormData): Promise<EtatComplement> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };
  const l = lire(formData);
  if ("erreur" in l) return { erreur: l.erreur };
  const { count } = await v.supabase.from("complements").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId);
  if ((count ?? 0) >= 30) return { erreur: "30 compléments au plus par cliente." };
  const { error } = await v.supabase.from("complements").insert({ ...l.ligne, cliente_id: clienteId, ordre: (count ?? 0) + 1 });
  if (error) return { erreur: erreurBase(error.code) };
  revalidatePath(`/coach/clientes/${clienteId}`);
  return { succes: `Ajouté à la liste de ${v.prenom} ✓` };
}

/** Modifie un complément (nom, quantité, moment, précision, en pause ou non). */
export async function modifierComplement(clienteId: string, id: string, _e: EtatComplement, formData: FormData): Promise<EtatComplement> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };
  if (!UUID.test(id)) return { erreur: "Complément introuvable." };
  const l = lire(formData);
  if ("erreur" in l) return { erreur: l.erreur };
  const { error } = await v.supabase
    .from("complements")
    .update({ ...l.ligne, actif: formData.get("actif") === "on" })
    .eq("id", id)
    .eq("cliente_id", clienteId);
  if (error) return { erreur: erreurBase(error.code) };
  revalidatePath(`/coach/clientes/${clienteId}`);
  return { succes: "Enregistré ✓" };
}

export async function supprimerComplement(clienteId: string, id: string): Promise<EtatComplement> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };
  if (!UUID.test(id)) return { erreur: "Complément introuvable." };
  const { error } = await v.supabase.from("complements").delete().eq("id", id).eq("cliente_id", clienteId);
  if (error) return { erreur: erreurBase(error.code) };
  revalidatePath(`/coach/clientes/${clienteId}`);
  return { succes: "Retiré de sa liste." };
}
