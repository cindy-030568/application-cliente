import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { avantApres, evolutionMesures, lireOffres, progressionCharges, type Evolution, type Offre, type Progression } from "./bilan-fin";
import { jourParisDe } from "./programme-sportif";
import { chargerBilans, chargerChamps } from "./suivi";

export type DonneesBilanFin = {
  prenom: string;
  debut: string | null;
  fin: string | null;
  sansChiffres: boolean;
  evolutions: Evolution[];
  progression: Progression[];
  photos: { avant: { date: string; chemin: string }; apres: { date: string; chemin: string } } | null;
  chiffres: { seances: number; bilans: number; joursJournal: number };
  texte: string;
  offres: Offre[];
  /** Offres sur lesquelles elle a déjà cliqué. */
  demandees: string[];
};

/**
 * Tout ce qu'il faut pour le bilan de fin d'une cliente (droits du client Supabase fourni : RLS).
 * Respecte le mode sans chiffres (ni mesures ni photos) et le masquage du poids.
 */
export async function chargerBilanFin(
  supabase: SupabaseClient,
  c: { id: string; prenom: string; date_debut: string | null; date_fin: string | null; mode_sans_chiffres: boolean; masquer_graph_poids: boolean },
): Promise<DonneesBilanFin> {
  const [champs, bilans, { data: charges }, { count: seances }, { count: joursJournal }, { data: reglages }, { data: demandes }] = await Promise.all([
    chargerChamps(supabase, true),
    chargerBilans(supabase, c.id),
    supabase.from("charges_series").select("exercice_cle, exercice_nom, charge_kg, faite_le").eq("cliente_id", c.id).order("faite_le").limit(1000),
    supabase.from("seances_faites").select("id", { count: "exact", head: true }).eq("cliente_id", c.id),
    supabase.from("journal_quotidien").select("jour", { count: "exact", head: true }).eq("cliente_id", c.id),
    supabase.from("reglages").select("fin_texte, fin_offres").maybeSingle<{ fin_texte: string; fin_offres: unknown }>(),
    supabase.from("demandes_suite").select("offre").eq("cliente_id", c.id),
  ]);
  return {
    prenom: c.prenom,
    debut: c.date_debut,
    fin: c.date_fin,
    sansChiffres: c.mode_sans_chiffres,
    evolutions: evolutionMesures(bilans, champs, { sansChiffres: c.mode_sans_chiffres, masquerPoids: c.masquer_graph_poids }),
    progression: progressionCharges(
      (charges ?? []).map((x) => ({ exercice_cle: x.exercice_cle as string, exercice_nom: x.exercice_nom as string, charge_kg: Number(x.charge_kg), jour: jourParisDe(x.faite_le as string) })),
    ),
    photos: c.mode_sans_chiffres ? null : avantApres(bilans),
    chiffres: { seances: seances ?? 0, bilans: bilans.length, joursJournal: joursJournal ?? 0 },
    texte: reglages?.fin_texte ?? "",
    offres: lireOffres(reglages?.fin_offres),
    demandees: (demandes ?? []).map((d) => d.offre as string),
  };
}
