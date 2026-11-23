"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { lireSession } from "@/lib/auth";
import { detecterAlerte } from "@/lib/alertes-notes";
import { notifierCoach } from "@/lib/notifications-coach";
import { cleExercice } from "@/lib/programme-sportif";
import { lireMonProgramme } from "@/lib/programme-sportif-serveur";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La cliente a ouvert son programme sportif (la coach voit « vu le … »). */
export async function marquerProgrammeVu(programmeId: string): Promise<void> {
  const session = await lireSession();
  if (!session || session.profil.role === "coach" || !UUID.test(programmeId)) return;
  await session.supabase.rpc("programme_sportif_vu", { p_programme: programmeId });
}

export type EtatSeanceFaite = { erreur?: string; succes?: string };

/** Fin du mode séance : la cliente valide sa séance (la coach la voit dans sa fiche). */
export async function validerSeance(
  programmeId: string,
  seance: number,
  infos: { dureeMinutes: number | null; ressenti: number | null; commentaire: string },
): Promise<EtatSeanceFaite> {
  const session = await lireSession();
  if (!session || session.profil.role === "coach") return { erreur: "Ta session a expiré : reconnecte-toi, puis valide à nouveau." };
  // Le nom de la séance vient du programme publié, pas du navigateur.
  const programme = await lireMonProgramme(session.supabase);
  const s = programme?.id === programmeId ? programme.contenu.seances[seance] : undefined;
  if (!programme || !s) return { erreur: "Ce programme n’est plus en ligne : la séance n’a pas pu être enregistrée." };
  const duree = infos.dureeMinutes !== null && Number.isFinite(infos.dureeMinutes) ? Math.min(Math.max(Math.round(infos.dureeMinutes), 0), 600) : null;
  const ressenti = infos.ressenti !== null && [1, 2, 3, 4, 5].includes(infos.ressenti) ? infos.ressenti : null;
  const { error } = await session.supabase.from("seances_faites").insert({
    programme_id: programme.id,
    seance_nom: s.nom.slice(0, 100),
    duree_minutes: duree,
    ressenti,
    commentaire: infos.commentaire.trim().slice(0, 500) || null,
  });
  if (error) {
    // Avant la mise à jour 0019 : la séance n'est pas enregistrée, mais rien ne casse.
    if (["42P01", "PGRST205"].includes(error.code)) return { erreur: "L’enregistrement des séances n’est pas encore activé par Cindy. Bravo quand même ! 💪" };
    return { erreur: "La séance n’a pas pu être enregistrée. Vérifie ta connexion et réessaie." };
  }
  revalidatePath("/sport");
  const clienteId = session.profil.id;
  const nom = s.nom.slice(0, 100);
  const motif = detecterAlerte(infos.commentaire);
  after(async () => {
    if (motif) await notifierCoach({ type: "alerte", clienteId, motif, source: "seance" });
    await notifierCoach({ type: "seance", clienteId, nom });
  });
  return { succes: "Séance enregistrée : Cindy la verra. Bravo ! 💪" };
}

export type ChargeNotee = { exercice: string; serie: number; kg: number };

/**
 * Mode séance : la cliente note le poids d'une ou plusieurs séries (corrigeable : même séance + même série = mise à jour).
 * Renvoie true si c'est enregistré (sinon l'écran réessaiera à la fin de la séance).
 */
export async function noterCharges(programmeId: string, seanceRef: string, lignes: ChargeNotee[]): Promise<boolean> {
  const session = await lireSession();
  if (!session || session.profil.role === "coach" || !UUID.test(seanceRef) || !UUID.test(programmeId)) return false;
  const propres = lignes
    .slice(0, 100)
    .filter((l) => typeof l.exercice === "string" && l.exercice.trim() && Number.isInteger(l.serie) && l.serie >= 1 && l.serie <= 50 && Number.isFinite(l.kg) && l.kg >= 0 && l.kg <= 500)
    .map((l) => ({
      programme_id: programmeId,
      seance_ref: seanceRef,
      exercice_cle: cleExercice(l.exercice).slice(0, 120),
      exercice_nom: l.exercice.trim().slice(0, 120),
      serie: l.serie,
      charge_kg: Math.round(l.kg * 10) / 10,
      cliente_id: session.profil.id,
    }))
    .filter((l) => l.exercice_cle);
  if (!propres.length) return true;
  const { error } = await session.supabase.from("charges_series").upsert(propres, { onConflict: "cliente_id,seance_ref,exercice_cle,serie" });
  return !error;
}
