"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ajouterJours } from "@/lib/bilan";
import { rayonPour } from "@/lib/courses";
import { estRepasMenu, proposerBatch, proposerMenu, type CaseMenu } from "@/lib/menus";
import { chargerRecettes } from "@/lib/recettes";
import { SESSION_PERDUE, UUID, sessionCoach } from "../clientes/verification";

export type EtatMenu = { erreur?: string; succes?: string; batch?: string };

const LUNDI = /^\d{4}-\d{2}-\d{2}$/;
const MIGRATION = "Fais d’abord la mise à jour de la base : fichier 0047_menus_semaine.sql (voir le guide).";
const erreurBase = (code?: string) => (["42P01", "PGRST205", "42703", "PGRST204"].includes(code ?? "") ? MIGRATION : "L’enregistrement a échoué. Réessaie.");
const estLundi = (j: string) => LUNDI.test(j) && new Date(`${j}T12:00:00Z`).getUTCDay() === 1;

function rafraichir(lundi: string) {
  revalidatePath("/coach/menus");
  revalidatePath(`/coach/menus/${lundi}`);
  revalidatePath("/espace/recettes", "layout");
  revalidatePath("/espace");
}

/** Le menu de ce lundi (créé en brouillon s'il n'existe pas encore). */
async function menuDe(supabase: SupabaseClient, lundi: string, creer: boolean): Promise<{ id?: string; erreur?: string }> {
  const { data, error } = await supabase.from("menus_semaine").select("id").eq("lundi", lundi).maybeSingle<{ id: string }>();
  if (error) return { erreur: erreurBase(error.code) };
  if (data || !creer) return { id: data?.id };
  const { data: cree, error: e2 } = await supabase.from("menus_semaine").insert({ lundi }).select("id").single<{ id: string }>();
  if (e2 || !cree) return { erreur: erreurBase(e2?.code) };
  return { id: cree.id };
}

/**
 * L'appli propose le menu : seulement les cases vides (« vides »), ou tout le menu (« tout »).
 * Les recettes des deux semaines d'avant passent en dernier.
 */
export async function proposerMenuSemaine(lundi: string, mode: "vides" | "tout"): Promise<EtatMenu> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!estLundi(lundi)) return { erreur: "Semaine introuvable." };
  const { supabase } = session;
  const menu = await menuDe(supabase, lundi, true);
  if (!menu.id) return { erreur: menu.erreur };
  const [recettes, { data: actuelles }, { data: avant }] = await Promise.all([
    chargerRecettes(supabase),
    supabase.from("menus_repas").select("jour, repas, recette_id").eq("menu_id", menu.id).returns<CaseMenu[]>(),
    supabase
      .from("menus_repas")
      .select("recette_id, menus_semaine!inner(lundi)")
      .gte("menus_semaine.lundi", ajouterJours(lundi, -14))
      .lt("menus_semaine.lundi", lundi),
  ]);
  const publiees = recettes.filter((r) => r.publiee);
  if (!publiees.length) return { erreur: "Aucune recette publiée : publie d’abord quelques recettes." };
  const cases = proposerMenu(publiees, {
    graine: lundi + (mode === "tout" ? String(Date.now()) : ""),
    recentes: (avant ?? []).map((a) => a.recette_id as string),
    garder: mode === "vides" ? (actuelles ?? []) : [],
  });
  await supabase.from("menus_repas").delete().eq("menu_id", menu.id);
  const { error } = await supabase.from("menus_repas").insert(cases.map((c) => ({ ...c, menu_id: menu.id })));
  if (error) return { erreur: erreurBase(error.code) };
  await supabase.from("menus_semaine").update({ maj_le: new Date().toISOString() }).eq("id", menu.id);
  rafraichir(lundi);
  return { succes: mode === "tout" ? "Nouveau menu proposé ✓ Retouche ce que tu veux." : "Cases vides complétées ✓" };
}

/** Une case du menu : une recette, ou vide (recetteId null). */
export async function choisirRecetteMenu(lundi: string, jour: number, repas: string, recetteId: string | null): Promise<EtatMenu> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!estLundi(lundi) || !Number.isInteger(jour) || jour < 1 || jour > 7 || !estRepasMenu(repas)) return { erreur: "Case introuvable." };
  if (recetteId !== null && !UUID.test(recetteId)) return { erreur: "Recette introuvable." };
  const { supabase } = session;
  const menu = await menuDe(supabase, lundi, recetteId !== null);
  if (!menu.id) return { erreur: menu.erreur };
  const { error } = recetteId
    ? await supabase.from("menus_repas").upsert({ menu_id: menu.id, jour, repas, recette_id: recetteId }, { onConflict: "menu_id,jour,repas" })
    : await supabase.from("menus_repas").delete().eq("menu_id", menu.id).eq("jour", jour).eq("repas", repas);
  if (error) return { erreur: erreurBase(error.code) };
  rafraichir(lundi);
  return {};
}

/** Propose les étapes du batch cooking d'après les déjeuners et dîners du menu (non enregistrées : à relire). */
export async function proposerEtapesBatch(lundi: string): Promise<EtatMenu> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!estLundi(lundi)) return { erreur: "Semaine introuvable." };
  const { supabase } = session;
  const menu = await menuDe(supabase, lundi, false);
  if (!menu.id) return { erreur: menu.erreur ?? "Prépare d’abord le menu de la semaine." };
  const [{ data: cases }, recettes] = await Promise.all([
    supabase.from("menus_repas").select("jour, repas, recette_id").eq("menu_id", menu.id).returns<CaseMenu[]>(),
    chargerRecettes(supabase),
  ]);
  if (!cases?.length) return { erreur: "Prépare d’abord le menu de la semaine." };
  // Une recette au déjeuner ou au dîner de ce menu compte pour le batch, quelle que soit sa case.
  const principales = new Set(cases.filter((c) => c.repas === "dejeuner" || c.repas === "diner").map((c) => c.recette_id));
  const toutes = new Set(cases.map((c) => c.recette_id));
  const duMenu = recettes
    .filter((r) => toutes.has(r.id))
    .map((r) => ({ ...r, repas: principales.has(r.id) ? ["dejeuner"] : ["petit_dejeuner"] }));
  const ids = [...new Set(duMenu.flatMap((r) => r.ingredients.map((i) => i.aliment_id)))];
  const { data: aliments } = await supabase.from("aliments").select("id, nom, groupe, sous_groupe").in("id", ids);
  const rayons = new Map((aliments ?? []).map((a) => [a.id as string, rayonPour(a.groupe ?? null, a.sous_groupe ?? null, [], a.nom ?? "")]));
  return { batch: proposerBatch(duMenu, (id) => rayons.get(id) ?? "Divers") };
}

/** Ton mot de la semaine et les étapes du batch cooking. */
export async function enregistrerTextesMenu(lundi: string, _e: EtatMenu, formData: FormData): Promise<EtatMenu> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!estLundi(lundi)) return { erreur: "Semaine introuvable." };
  const mot = String(formData.get("mot") ?? "").trim().slice(0, 1000) || null;
  const batch = String(formData.get("batch") ?? "").replace(/\r/g, "").trim().slice(0, 4000) || null;
  const { supabase } = session;
  const menu = await menuDe(supabase, lundi, true);
  if (!menu.id) return { erreur: menu.erreur };
  const { error } = await supabase.from("menus_semaine").update({ mot, batch, maj_le: new Date().toISOString() }).eq("id", menu.id);
  if (error) return { erreur: erreurBase(error.code) };
  rafraichir(lundi);
  return { succes: "Enregistré ✓" };
}

export async function publierMenu(lundi: string, publie: boolean): Promise<EtatMenu> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!estLundi(lundi)) return { erreur: "Semaine introuvable." };
  const { supabase } = session;
  const menu = await menuDe(supabase, lundi, false);
  if (!menu.id) return { erreur: menu.erreur ?? "Prépare d’abord le menu de la semaine." };
  if (publie) {
    const { count } = await supabase.from("menus_repas").select("jour", { count: "exact", head: true }).eq("menu_id", menu.id);
    if (!count) return { erreur: "Le menu est vide : propose-le ou choisis des recettes d’abord." };
  }
  const { error } = await supabase.from("menus_semaine").update({ publie }).eq("id", menu.id);
  if (error) return { erreur: erreurBase(error.code) };
  rafraichir(lundi);
  return { succes: publie ? "Publié ✓ Tes abonnées le voient." : "Repassé en brouillon : tes abonnées ne le voient plus." };
}
