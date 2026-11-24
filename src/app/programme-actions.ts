"use server";

import { revalidatePath } from "next/cache";
import { lireSession } from "@/lib/auth";
import { enregistrerCharges, enregistrerSeance, enregistrerSeanceExpress, notifierSeanceFaite, type ChargeNotee, type InfosSeance } from "@/lib/seances-enregistrement";

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
  return { succes: "Séance enregistrée : je la verrai. Bravo ! 💪" };
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

/** Fin d'une séance express : enregistrée comme « séance libre », à part du programme. */
export async function validerSeanceExpress(seanceExpressId: string, infos: InfosSeance, ref?: string | null): Promise<EtatSeanceFaite> {
  const session = await lireSession();
  if (!session || session.profil.role === "coach") return { erreur: "Ta session a expiré : reconnecte-toi, puis valide à nouveau." };
  const r = await enregistrerSeanceExpress(session.supabase, session.profil.id, { seanceExpressId, infos, ref });
  if ("erreur" in r) return { erreur: r.erreur };
  revalidatePath("/seances-express");
  if (r.nouveau) notifierSeanceFaite(session.profil.id, `${r.nom} (séance express)`, infos.commentaire);
  return { succes: "Séance express enregistrée : je la verrai. Bravo d’avoir bougé quand même ! 💪" };
}

/** Poids notés pendant une séance express (pas de programme rattaché). */
export async function noterChargesExpress(seanceRef: string, lignes: ChargeNotee[]): Promise<boolean> {
  const session = await lireSession();
  if (!session || session.profil.role === "coach") return false;
  return (await enregistrerCharges(session.supabase, session.profil.id, null, seanceRef, lignes)).ok;
}

/** Met une séance express en favori (ou l'en retire). */
export async function basculerFavoriExpress(seanceExpressId: string, favori: boolean): Promise<{ erreur?: string }> {
  const session = await lireSession();
  if (!session || session.profil.role === "coach") return { erreur: "Ta session a expiré. Reconnecte-toi, puis réessaie." };
  if (!UUID.test(seanceExpressId)) return { erreur: "Séance introuvable." };
  const { error } = favori
    ? await session.supabase.from("seances_express_favoris").upsert({ cliente_id: session.profil.id, seance_id: seanceExpressId }, { onConflict: "cliente_id,seance_id", ignoreDuplicates: true })
    : await session.supabase.from("seances_express_favoris").delete().eq("cliente_id", session.profil.id).eq("seance_id", seanceExpressId);
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  revalidatePath("/seances-express");
  return {};
}
