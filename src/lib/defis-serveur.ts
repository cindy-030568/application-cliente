import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ajouterJours } from "./bilan";
import type { Defi, Progression } from "./defis";

const COLONNES_0042 = "id, titre, description, type, seuil, objectif, debut, fin, audience, publie";
const COLONNES = `${COLONNES_0042}, pour_abonnees`;
type Ligne = Omit<Defi, "seuil"> & { seuil: number | string | null };
const lire = (l: Ligne): Defi => ({ ...l, seuil: l.seuil === null ? null : Number(l.seuil) });

/** Tous les défis (la RLS ne montre à une cliente que les siens), ou null avant la mise à jour 0042. */
export async function lireDefis(supabase: SupabaseClient): Promise<Defi[] | null> {
  let { data, error } = await supabase.from("defis").select(COLONNES).order("debut", { ascending: false }).returns<Ligne[]>();
  // Avant la mise à jour 0046 (pas encore « pour les abonnées »).
  if (error) ({ data, error } = await supabase.from("defis").select(COLONNES_0042).order("debut", { ascending: false }).returns<Ligne[]>());
  if (error) return null;
  return (data ?? []).map(lire);
}

export async function lireDefi(supabase: SupabaseClient, id: string): Promise<Defi | null> {
  const premier = await supabase.from("defis").select(COLONNES).eq("id", id).maybeSingle<Ligne>();
  let { data } = premier;
  if (premier.error) ({ data } = await supabase.from("defis").select(COLONNES_0042).eq("id", id).maybeSingle<Ligne>());
  return data ? lire(data) : null;
}

export type Participation = { defi_id: string; afficher_prenom: boolean; reussi_le: string | null };
export type DefiCliente = Defi & { participation: Participation | null; progression: Progression | null };

/**
 * Les défis à montrer à une cliente : à venir (dans les 14 jours), en cours, ou terminés depuis
 * moins de 7 jours. Avec sa participation et la progression (calculée par la base).
 * [] avant la mise à jour 0042.
 */
export async function defisDeLaCliente(supabase: SupabaseClient, clienteId: string, aujourdhui: string): Promise<DefiCliente[]> {
  const requete = (colonnes: string) =>
    supabase
      .from("defis")
      .select(colonnes)
      .eq("publie", true)
      .lte("debut", ajouterJours(aujourdhui, 14))
      .gte("fin", ajouterJours(aujourdhui, -7))
      .order("debut")
      .returns<Ligne[]>();
  let { data, error } = await requete(COLONNES);
  if (error) ({ data, error } = await requete(COLONNES_0042));
  if (error || !data?.length) return [];
  const { data: parts } = await supabase
    .from("defis_participations")
    .select("defi_id, afficher_prenom, reussi_le")
    .eq("cliente_id", clienteId)
    .in("defi_id", data.map((d) => d.id))
    .returns<Participation[]>();
  return Promise.all(
    data.map(async (l) => {
      const d = lire(l);
      const participation = parts?.find((p) => p.defi_id === d.id) ?? null;
      let progression: Progression | null = null;
      if (d.debut <= aujourdhui) {
        const { data: p } = await supabase.rpc("ma_progression_defi", { p_defi: d.id }).maybeSingle<Progression>();
        if (p) progression = { ...p, reussi: Boolean(p.reussi) };
      }
      return { ...d, participation, progression };
    }),
  );
}

export type ProgressionCliente = { cliente_id: string; reussites: number; reussi_le: string | null; afficher_prenom: boolean };

/** Pour la coach : la progression de chaque participante. */
export async function progressionsDefi(supabase: SupabaseClient, defiId: string): Promise<ProgressionCliente[]> {
  const { data } = await supabase.rpc("progressions_defi", { p_defi: defiId });
  return ((data ?? []) as ProgressionCliente[]).map((p) => ({ ...p, reussites: Number(p.reussites) }));
}

/** Pour la coach : nombre de participantes et de réussites par défi. */
export async function compteursDefis(supabase: SupabaseClient): Promise<Map<string, { participantes: number; reussites: number }>> {
  const { data } = await supabase.from("defis_participations").select("defi_id, reussi_le").limit(5000);
  const m = new Map<string, { participantes: number; reussites: number }>();
  for (const p of data ?? []) {
    const c = m.get(p.defi_id as string) ?? { participantes: 0, reussites: 0 };
    c.participantes++;
    if (p.reussi_le) c.reussites++;
    m.set(p.defi_id as string, c);
  }
  return m;
}
