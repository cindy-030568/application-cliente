"use server";

import { revalidatePath } from "next/cache";
import { lireFormulaireDefi } from "@/lib/defis";
import { SESSION_PERDUE, UUID, sessionCoach } from "../clientes/verification";

export type EtatDefi = { erreur?: string; succes?: string; id?: string };
const MIGRATION = "Fais d’abord la mise à jour de la base : fichier 0042_defis.sql (voir le guide).";
const erreurBase = (code?: string) =>
  ["42P01", "PGRST205", "42703", "PGRST204"].includes(code ?? "") ? MIGRATION : code === "23514" ? "Vérifie l’objectif et les dates du défi." : "L’enregistrement a échoué. Réessaie.";

function rafraichir(id?: string | null) {
  revalidatePath("/coach/defis");
  if (id) revalidatePath(`/coach/defis/${id}`);
  revalidatePath("/defis");
  revalidatePath("/");
}

/** Crée ou modifie un défi. */
export async function enregistrerDefi(id: string | null, _e: EtatDefi, formData: FormData): Promise<EtatDefi> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (id && !UUID.test(id)) return { erreur: "Défi introuvable." };
  const champ = (n: string) => String(formData.get(n) ?? "");
  const r = lireFormulaireDefi({
    titre: champ("titre"),
    description: champ("description"),
    type: champ("type"),
    seuil: champ("seuil"),
    objectif: champ("objectif"),
    debut: champ("debut"),
    fin: champ("fin"),
    audience: champ("audience"),
  });
  if (!r.valeurs) return { erreur: r.erreur };
  const valeurs = { ...r.valeurs, ...(id ? {} : { publie: formData.get("publie") === "on" }) };
  const { supabase } = session;
  if (id) {
    const { error } = await supabase.from("defis").update(valeurs).eq("id", id);
    if (error) return { erreur: erreurBase(error.code) };
    rafraichir(id);
    return { succes: "Défi enregistré ✓", id };
  }
  const { data, error } = await supabase.from("defis").insert(valeurs).select("id").single();
  if (error || !data) return { erreur: erreurBase(error?.code) };
  rafraichir(data.id as string);
  return { succes: "Défi créé ✓", id: data.id as string };
}

export async function publierDefi(id: string, publie: boolean): Promise<EtatDefi> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(id)) return { erreur: "Défi introuvable." };
  const { error } = await session.supabase.from("defis").update({ publie }).eq("id", id);
  if (error) return { erreur: erreurBase(error.code) };
  rafraichir(id);
  return { succes: publie ? "Publié ✓ Tes clientes le voient." : "Repassé en brouillon." };
}

export async function supprimerDefi(id: string): Promise<EtatDefi> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(id)) return { erreur: "Défi introuvable." };
  const { error } = await session.supabase.from("defis").delete().eq("id", id);
  if (error) return { erreur: erreurBase(error.code) };
  rafraichir();
  return { succes: "Défi supprimé." };
}
