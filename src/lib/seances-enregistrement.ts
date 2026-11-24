import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { detecterAlerte } from "@/lib/alertes-notes";
import { notifierCoach } from "@/lib/notifications-coach";
import { cleExercice, type Programme } from "@/lib/programme-sportif";
import { lireMonProgramme } from "@/lib/programme-sportif-serveur";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type InfosSeance = { dureeMinutes: number | null; ressenti: number | null; commentaire: string };
export type ChargeNotee = { exercice: string; serie: number; kg: number };

/** Heure où la séance a été faite (séance envoyée après coup) : au plus 30 jours avant, jamais dans le futur. */
export function heureSeance(faiteLe: string | null | undefined, maintenant = Date.now()): string {
  const t = faiteLe ? Date.parse(faiteLe) : NaN;
  if (!Number.isFinite(t) || t > maintenant + 5 * 60_000 || t < maintenant - 30 * 86_400_000) return new Date(maintenant).toISOString();
  return new Date(Math.min(t, maintenant)).toISOString();
}

/**
 * Enregistre une séance faite par la cliente connectée (en direct ou envoyée au retour du réseau).
 * Le nom de la séance vient du programme (pas du téléphone) ; si le programme a changé entre-temps,
 * celui de l'ancien programme, sinon le nom gardé sur le téléphone.
 * `ref` : identifiant créé sur le téléphone, pour ne jamais l'enregistrer deux fois.
 */
export async function enregistrerSeance(
  supabase: SupabaseClient,
  clienteId: string,
  p: { programmeId: string; seance: number; infos: InfosSeance; ref?: string | null; faiteLe?: string | null; nomSecours?: string | null },
): Promise<{ ok: true; nouveau: boolean; nom: string } | { erreur: string; definitif: boolean }> {
  if (!UUID.test(p.programmeId) || !Number.isInteger(p.seance) || p.seance < 0 || p.seance > 50) return { erreur: "Séance introuvable.", definitif: true };
  let nom: string | undefined;
  const actuel = await lireMonProgramme(supabase);
  if (actuel?.id === p.programmeId) nom = actuel.contenu.seances[p.seance]?.nom;
  if (!nom) {
    const { data } = await supabase.from("programmes_sportifs").select("contenu").eq("id", p.programmeId).maybeSingle<{ contenu: Programme }>();
    nom = data?.contenu?.seances?.[p.seance]?.nom ?? (p.nomSecours?.trim() || undefined);
  }
  if (!nom) return { erreur: "Ce programme n’est plus en ligne : la séance n’a pas pu être enregistrée.", definitif: true };
  const duree = p.infos.dureeMinutes !== null && Number.isFinite(p.infos.dureeMinutes) ? Math.min(Math.max(Math.round(p.infos.dureeMinutes), 0), 600) : null;
  const ressenti = p.infos.ressenti !== null && [1, 2, 3, 4, 5].includes(p.infos.ressenti) ? p.infos.ressenti : null;
  const ligne = {
    cliente_id: clienteId,
    programme_id: p.programmeId,
    seance_nom: nom.slice(0, 100),
    duree_minutes: duree,
    ressenti,
    commentaire: String(p.infos.commentaire ?? "").trim().slice(0, 500) || null,
    faite_le: heureSeance(p.faiteLe),
  };
  const ref = p.ref && UUID.test(p.ref) ? p.ref : null;
  if (ref) {
    const { data, error } = await supabase
      .from("seances_faites")
      .upsert({ ...ligne, ref_locale: ref }, { onConflict: "cliente_id,ref_locale", ignoreDuplicates: true })
      .select("id");
    if (!error) return { ok: true, nouveau: (data ?? []).length > 0, nom: ligne.seance_nom };
    // Avant la mise à jour 0030 (pas de colonne ref_locale) : enregistrement simple ci-dessous.
    if (!["42703", "PGRST204", "42P10"].includes(error.code)) return erreurSeance(error.code);
  }
  const { error } = await supabase.from("seances_faites").insert(ligne);
  if (error) return erreurSeance(error.code);
  return { ok: true, nouveau: true, nom: ligne.seance_nom };
}

function erreurSeance(code: string): { erreur: string; definitif: boolean } {
  // Avant la mise à jour 0019 : rien ne casse.
  if (["42P01", "PGRST205"].includes(code)) return { erreur: "L’enregistrement des séances n’est pas encore activé. Bravo quand même ! 💪", definitif: true };
  // Accès fermé (refus de la base) : inutile de réessayer.
  if (code === "42501") return { erreur: "Ton accès est fermé : la séance n’a pas pu être enregistrée.", definitif: true };
  return { erreur: "La séance n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.", definitif: false };
}

/** Poids notés pendant une séance (même séance + même série = mise à jour : renvoyer ne crée pas de doublon). */
export async function enregistrerCharges(supabase: SupabaseClient, clienteId: string, programmeId: string, seanceRef: string, lignes: ChargeNotee[]) {
  if (!UUID.test(seanceRef) || !UUID.test(programmeId) || !Array.isArray(lignes)) return { ok: false, definitif: true };
  const propres = lignes
    .slice(0, 100)
    .filter((l) => l && typeof l.exercice === "string" && l.exercice.trim() && Number.isInteger(l.serie) && l.serie >= 1 && l.serie <= 50 && Number.isFinite(l.kg) && l.kg >= 0 && l.kg <= 500)
    .map((l) => ({
      programme_id: programmeId,
      seance_ref: seanceRef,
      exercice_cle: cleExercice(l.exercice).slice(0, 120),
      exercice_nom: l.exercice.trim().slice(0, 120),
      serie: l.serie,
      charge_kg: Math.round(l.kg * 10) / 10,
      cliente_id: clienteId,
    }))
    .filter((l) => l.exercice_cle);
  if (!propres.length) return { ok: true, definitif: false };
  const { error } = await supabase.from("charges_series").upsert(propres, { onConflict: "cliente_id,seance_ref,exercice_cle,serie" });
  if (!error) return { ok: true, definitif: false };
  return { ok: false, definitif: ["42P01", "PGRST205", "42501", "23503"].includes(error.code) };
}

/** Prévient la coach (séance faite, et note à lire vite si le commentaire en contient une), après la réponse. */
export function notifierSeanceFaite(clienteId: string, nom: string, commentaire: string) {
  const motif = detecterAlerte(commentaire);
  after(async () => {
    if (motif) await notifierCoach({ type: "alerte", clienteId, motif, source: "seance" });
    await notifierCoach({ type: "seance", clienteId, nom });
  });
}
