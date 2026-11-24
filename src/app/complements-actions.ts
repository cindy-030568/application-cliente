"use server";

import { revalidatePath } from "next/cache";
import { lireSession } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";

export type EtatComplements = { erreur?: string; succes?: string };
const SESSION_EXPIREE = "Ta session a expiré. Reconnecte-toi, puis réessaie.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sessionCliente() {
  const session = await lireSession();
  return session && session.profil.role === "cliente" ? session : null;
}

/** Coche (ou décoche) un complément pris aujourd'hui. */
export async function cocherComplement(id: string, pris: boolean): Promise<EtatComplements> {
  const session = await sessionCliente();
  if (!session) return { erreur: SESSION_EXPIREE };
  if (!UUID.test(id)) return { erreur: "Complément introuvable." };
  const jour = aujourdhuiParis();
  const { error } = pris
    ? await session.supabase.from("complements_pris").upsert({ complement_id: id, cliente_id: session.profil.id, jour }, { onConflict: "complement_id,jour", ignoreDuplicates: true })
    : await session.supabase.from("complements_pris").delete().eq("complement_id", id).eq("jour", jour);
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  revalidatePath("/complements");
  revalidatePath("/");
  return {};
}

/** Heure du rappel quotidien des compléments (« 08:00 »), ou null pour le couper. */
export async function definirRappelComplements(heure: string | null): Promise<EtatComplements> {
  const session = await sessionCliente();
  if (!session) return { erreur: SESSION_EXPIREE };
  if (heure !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(heure))) return { erreur: "L’heure n’est pas valide." };
  const { error } = await session.supabase.rpc("definir_rappel_complements", { p_heure: heure });
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  revalidatePath("/complements");
  return { succes: heure ? `C’est noté : un petit rappel chaque jour à ${heure.replace(":", " h ")}.` : "Rappel coupé." };
}
