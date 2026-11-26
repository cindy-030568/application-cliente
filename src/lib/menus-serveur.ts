import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ajouterJours } from "./bilan";
import { semaineAMontrer, type CaseMenu } from "./menus";
import { lundiDe } from "./recap-semaine";

export type MenuPublie = { id: string; lundi: string; mot: string | null; batch: string | null; cases: CaseMenu[]; lundis: string[] };

/**
 * Le menu publié à montrer à l'abonnée (la RLS ne lui donne que les menus publiés) :
 * la semaine demandée si elle est publiée et proche (semaine d'avant, en cours, suivante), sinon celle du jour.
 * null s'il n'y a rien (ou avant la mise à jour 0047).
 */
export async function lireMenuPublie(supabase: SupabaseClient, aujourdhui: string, demande?: string | null): Promise<MenuPublie | null> {
  const cette = lundiDe(aujourdhui);
  const { data, error } = await supabase
    .from("menus_semaine")
    .select("id, lundi, mot, batch")
    .eq("publie", true)
    .gte("lundi", ajouterJours(cette, -7))
    .lte("lundi", ajouterJours(cette, 7))
    .order("lundi")
    .returns<{ id: string; lundi: string; mot: string | null; batch: string | null }[]>();
  if (error || !data?.length) return null;
  const lundis = data.map((m) => m.lundi);
  const lundi = demande && lundis.includes(demande) ? demande : semaineAMontrer(aujourdhui, lundis);
  const menu = data.find((m) => m.lundi === lundi);
  if (!menu) return null;
  const { data: cases } = await supabase.from("menus_repas").select("jour, repas, recette_id").eq("menu_id", menu.id).returns<CaseMenu[]>();
  return { ...menu, cases: cases ?? [], lundis };
}
