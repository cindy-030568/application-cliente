import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { grammesMacros, lireContenu, type ContenuPlan, type Formule, type Objectifs, type Sexe } from "./plan-alimentaire";

/** Lu à part : tant que la mise à jour 0015 n'est pas faite, ces fonctions renvoient null. */

export type Besoins = {
  sexe: Sexe;
  date_naissance: string | null;
  taille_cm: number | null;
  poids_kg: number | null;
  poids_objectif_kg: number | null;
  masse_grasse_pct: number | null;
  formule: Formule;
  nap_actuel: number;
  nap_objectif: number;
  kcal_objectif: number | null;
  pct_lipides: number;
  pct_glucides: number;
  pct_proteines: number;
  fibres_g: number;
};

export const BESOINS_PAR_DEFAUT: Besoins = {
  sexe: "femme",
  date_naissance: null,
  taille_cm: null,
  poids_kg: null,
  poids_objectif_kg: null,
  masse_grasse_pct: null,
  formule: "black",
  nap_actuel: 1.4,
  nap_objectif: 1.6,
  kcal_objectif: null,
  pct_lipides: 35,
  pct_glucides: 40,
  pct_proteines: 25,
  fibres_g: 30,
};

const COLONNES_BESOINS =
  "sexe, date_naissance, taille_cm, poids_kg, poids_objectif_kg, masse_grasse_pct, formule, nap_actuel, nap_objectif, kcal_objectif, pct_lipides, pct_glucides, pct_proteines, fibres_g";

const num = (v: unknown) => (v == null ? null : Number(v));

/** `null` : migration absente. Sinon les besoins enregistrés, ou ceux par défaut. */
export async function lireBesoins(supabase: SupabaseClient, clienteId: string): Promise<{ besoins: Besoins; enregistres: boolean } | null> {
  const { data, error } = await supabase.from("besoins_clientes").select(COLONNES_BESOINS).eq("cliente_id", clienteId).maybeSingle();
  if (error) return null;
  if (!data) return { besoins: BESOINS_PAR_DEFAUT, enregistres: false };
  const d = data as Record<string, unknown>;
  return {
    enregistres: true,
    besoins: {
      sexe: d.sexe as Sexe,
      date_naissance: (d.date_naissance as string | null) ?? null,
      taille_cm: num(d.taille_cm),
      poids_kg: num(d.poids_kg),
      poids_objectif_kg: num(d.poids_objectif_kg),
      masse_grasse_pct: num(d.masse_grasse_pct),
      formule: d.formule as Formule,
      nap_actuel: Number(d.nap_actuel),
      nap_objectif: Number(d.nap_objectif),
      kcal_objectif: num(d.kcal_objectif),
      pct_lipides: Number(d.pct_lipides),
      pct_glucides: Number(d.pct_glucides),
      pct_proteines: Number(d.pct_proteines),
      fibres_g: Number(d.fibres_g),
    },
  };
}

/** Dernier poids noté par la cliente dans son journal (pour pré-remplir), ou null. */
export async function dernierPoids(supabase: SupabaseClient, clienteId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("journal_quotidien")
    .select("poids")
    .eq("cliente_id", clienteId)
    .not("poids", "is", null)
    .order("jour", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return num((data as { poids: unknown }).poids);
}

/** Objectifs du plan à partir des besoins (null tant qu'il n'y a pas d'objectif calorique). */
export function objectifsDepuis(b: Besoins): Objectifs | null {
  if (!b.kcal_objectif) return null;
  const g = grammesMacros(b.kcal_objectif, { lipides: b.pct_lipides, glucides: b.pct_glucides, proteines: b.pct_proteines });
  return {
    kcal: b.kcal_objectif,
    lipides: Math.round(g.lipides),
    glucides: Math.round(g.glucides),
    proteines: Math.round(g.proteines),
    fibres: b.fibres_g || null,
  };
}

export type PlanAlimentaire = {
  id: string;
  cliente_id: string;
  titre: string;
  contenu: ContenuPlan;
  recommandations: string;
  publie: boolean;
  publie_le: string | null;
  vu_le: string | null;
  created_at: string;
  updated_at: string;
};
const COLONNES_PLAN_ALIM = "id, cliente_id, titre, contenu, recommandations, publie, publie_le, vu_le, created_at, updated_at";

function normaliser(d: Record<string, unknown>): PlanAlimentaire {
  return { ...(d as unknown as PlanAlimentaire), contenu: lireContenu(d.contenu) };
}

/** Plans de la cliente (le plus récent d'abord) ; null si la migration manque. */
export async function lirePlansAlimentaires(supabase: SupabaseClient, clienteId: string): Promise<PlanAlimentaire[] | null> {
  const { data, error } = await supabase
    .from("plans_alimentaires")
    .select(COLONNES_PLAN_ALIM)
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });
  if (error) return null;
  return (data ?? []).map((d) => normaliser(d as Record<string, unknown>));
}

export async function lirePlanAlimentaire(supabase: SupabaseClient, id: string): Promise<PlanAlimentaire | null> {
  const { data, error } = await supabase.from("plans_alimentaires").select(COLONNES_PLAN_ALIM).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return normaliser(data as Record<string, unknown>);
}

/** Côté cliente : son plan publié (la sécurité de la base ne laisse voir que celui-là). */
export async function lireMonPlanAlimentaire(supabase: SupabaseClient): Promise<PlanAlimentaire | null> {
  const { data, error } = await supabase.from("plans_alimentaires").select(COLONNES_PLAN_ALIM).eq("publie", true).limit(1).maybeSingle();
  if (error || !data) return null;
  return normaliser(data as Record<string, unknown>);
}
