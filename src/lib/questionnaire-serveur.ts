import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuestionArrivee } from "@/lib/questionnaire";

const BASE = "id, ordre, section, libelle, aide, type, options, obligatoire, actif";

/** Questions du questionnaire d'arrivée (avec cible et condition après la mise à jour 0032 ; sans elle, les colonnes de base). */
export async function chargerQuestions(supabase: SupabaseClient, toutes = false): Promise<QuestionArrivee[]> {
  const requete = (colonnes: string) => {
    const r = supabase.from("questions_arrivee").select(colonnes).order("ordre");
    return (toutes ? r : r.eq("actif", true)).returns<QuestionArrivee[]>();
  };
  const complet = await requete(`${BASE}, cible, condition`);
  if (!complet.error) return complet.data ?? [];
  const { data } = await requete(BASE);
  return data ?? [];
}
