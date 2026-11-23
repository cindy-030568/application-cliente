"use server";

import { revalidatePath } from "next/cache";
import { lireSession } from "@/lib/auth";
import { enregistrerCharges, enregistrerSeance, notifierSeanceFaite, type ChargeNotee, type InfosSeance } from "@/lib/seances-enregistrement";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La cliente a ouvert son programme sportif (la coach voit « vu le … »). */
export async function marquerProgrammeVu(programmeId: string): Promise<void> {
  const session = await lireSession();
  if (!session || session.profil.role === "coach" || !UUID.test(programmeId)) return;
  await session.supabase.rpc("programme_sportif_vu", { p_programme: programmeId });
}

export type EtatSeanceFaite = { erreur?: string; succes?: string };

/** Fin du mode séance : la cliente valide sa séance (la coach la voit dans sa fiche). */
export async function validerSeance(programmeId: string, seance: number, infos: InfosSeance, ref?: string | null): Promise<EtatSeanceFaite> {
  const session = await lireSession();
  if (!session || session.profil.role === "coach") return { erreur: "Ta session a expiré : reconnecte-toi, puis valide à nouveau." };
  const r = await enregistrerSeance(session.supabase, session.profil.id, { programmeId, seance, infos, ref });
  if ("erreur" in r) return { erreur: r.erreur };
  revalidatePath("/sport");
  if (r.nouveau) notifierSeanceFaite(session.profil.id, r.nom, infos.commentaire);
  return { succes: "Séance enregistrée : Cindy la verra. Bravo ! 💪" };
}

export type { ChargeNotee };

/**
 * Mode séance : la cliente note le poids d'une ou plusieurs séries (corrigeable : même séance + même série = mise à jour).
 * Renvoie true si c'est enregistré (sinon l'écran le garde et le renvoie au retour du réseau).
 */
export async function noterCharges(programmeId: string, seanceRef: string, lignes: ChargeNotee[]): Promise<boolean> {
  const session = await lireSession();
  if (!session || session.profil.role === "coach") return false;
  return (await enregistrerCharges(session.supabase, session.profil.id, programmeId, seanceRef, lignes)).ok;
}
