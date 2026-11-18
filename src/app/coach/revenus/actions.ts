"use server";

import { revalidatePath } from "next/cache";
import { estMoyen, lireCentimes } from "@/lib/paiements";
import { SESSION_PERDUE, UUID, sessionCoach } from "../clientes/verification";

export type EtatRevenu = { erreur?: string; succes?: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MIGRATION = "Fais d’abord la mise à jour de la base : fichier 0017_revenus.sql (voir le guide).";

function rafraichir(clienteId?: string | null) {
  revalidatePath("/coach/revenus");
  revalidatePath("/coach");
  if (clienteId) revalidatePath(`/coach/clientes/${clienteId}`);
}

export type ModifEcheance = { date_prevue: string; montant: string; payee_le: string | null; note: string };

/** Modifie une échéance : date prévue (report), montant, date d'encaissement, note. */
export async function modifierEcheance(id: string, m: ModifEcheance): Promise<EtatRevenu> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(id)) return { erreur: "Échéance introuvable." };
  if (!DATE.test(m.date_prevue)) return { erreur: "Indique la date prévue." };
  if (m.payee_le !== null && !DATE.test(m.payee_le)) return { erreur: "Indique la date d’encaissement." };
  const centimes = lireCentimes(m.montant);
  if (centimes === null || Number.isNaN(centimes)) return { erreur: "Montant illisible (ex. 112,50)." };
  const champs = { date_echeance: m.date_prevue, montant: centimes / 100, payee_le: m.payee_le };
  const { data, error } = await session.supabase.from("echeances_paiement").update(champs).eq("id", id).select("cliente_id").maybeSingle<{ cliente_id: string }>();
  if (error || !data) return { erreur: "La modification n’a pas pu être enregistrée. Réessaie." };
  // Note (mise à jour 0017) : enregistrée à part, ignorée si la colonne n'existe pas encore.
  await session.supabase.from("echeances_paiement").update({ note: m.note.trim().slice(0, 300) || null }).eq("id", id);
  rafraichir(data.cliente_id);
  return { succes: "Échéance enregistrée." };
}

/** Marque une échéance encaissée à une date donnée (aujourd'hui par défaut côté écran). */
export async function encaisserEcheance(id: string, date: string): Promise<EtatRevenu> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(id) || !DATE.test(date)) return { erreur: "Date d’encaissement manquante." };
  const { data, error } = await session.supabase.from("echeances_paiement").update({ payee_le: date }).eq("id", id).select("cliente_id").maybeSingle<{ cliente_id: string }>();
  if (error || !data) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  rafraichir(data.cliente_id);
  return { succes: "Encaissement noté." };
}

function lireRevenu(formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const libelle = String(formData.get("libelle") ?? "").trim().slice(0, 120);
  const centimes = lireCentimes(String(formData.get("montant") ?? ""));
  const moyen = String(formData.get("moyen") ?? "");
  const cliente = String(formData.get("cliente_id") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  if (!DATE.test(date)) return { erreur: "Indique la date." } as const;
  if (!libelle) return { erreur: "Indique ce que c’est (ex. « Atelier batch cooking »)." } as const;
  if (!centimes || Number.isNaN(centimes)) return { erreur: "Montant illisible (ex. 45 ou 49,90)." } as const;
  return {
    champs: {
      date_revenu: date,
      libelle,
      montant: centimes / 100,
      moyen: estMoyen(moyen) ? moyen : null,
      cliente_id: UUID.test(cliente) ? cliente : null,
      note: note || null,
    },
  } as const;
}

export async function ajouterRevenu(_e: EtatRevenu, formData: FormData): Promise<EtatRevenu> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const r = lireRevenu(formData);
  if (!r.champs) return { erreur: r.erreur };
  const { error } = await session.supabase.from("revenus_divers").insert(r.champs);
  if (error) return { erreur: ["42P01", "PGRST205"].includes(error.code) ? MIGRATION : "Le revenu n’a pas pu être enregistré. Réessaie." };
  rafraichir(r.champs.cliente_id);
  return { succes: "Revenu ajouté." };
}

export async function modifierRevenu(id: string, _e: EtatRevenu, formData: FormData): Promise<EtatRevenu> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(id)) return { erreur: "Revenu introuvable." };
  const r = lireRevenu(formData);
  if (!r.champs) return { erreur: r.erreur };
  const { error } = await session.supabase.from("revenus_divers").update(r.champs).eq("id", id);
  if (error) return { erreur: "La modification n’a pas pu être enregistrée." };
  rafraichir(r.champs.cliente_id);
  return { succes: "Revenu enregistré." };
}

export async function supprimerRevenu(id: string): Promise<EtatRevenu> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(id)) return { erreur: "Revenu introuvable." };
  const { error } = await session.supabase.from("revenus_divers").delete().eq("id", id);
  if (error) return { erreur: "Le revenu n’a pas pu être supprimé." };
  rafraichir();
  return { succes: "Revenu supprimé." };
}
