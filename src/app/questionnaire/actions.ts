"use server";

import { after } from "next/server";
import { exigerCliente } from "@/lib/auth";
import { lireQuestionnaire, type QuestionArrivee } from "@/lib/questionnaire";
import { notifierCoach } from "@/lib/notifications-coach";

export type EtatQuestionnaire = { erreur?: string; manquantes?: string[]; envoye?: boolean };

/** La cliente envoie son questionnaire d'arrivée : réponses gardées, exclusions et objectif pré-remplis dans sa fiche. */
export async function envoyerQuestionnaire(formData: FormData): Promise<EtatQuestionnaire> {
  const { supabase, profil } = await exigerCliente(true, true, false);
  const [{ data: questions }, { data: categories }] = await Promise.all([
    supabase.from("questions_arrivee").select("id, ordre, section, libelle, aide, type, options, obligatoire, actif").eq("actif", true).returns<QuestionArrivee[]>(),
    supabase.from("categories_aliment").select("id, nom"),
  ]);
  const lu = lireQuestionnaire(questions ?? [], formData as unknown as { get: (k: string) => string | null; getAll: (k: string) => string[] }, (categories ?? []) as { id: string; nom: string }[]);
  if (lu.manquantes.length) return { erreur: "Il manque quelques réponses (marquées d’un astérisque).", manquantes: lu.manquantes };
  const { error } = await supabase.rpc("envoyer_questionnaire", { p_reponses: lu.reponses, p_categories: lu.categoriesExclues, p_objectif: lu.objectif });
  if (error) return { erreur: "Tes réponses n’ont pas pu être envoyées. Réessaie dans un instant." };
  const prenom = profil.prenom;
  after(() => notifierCoach({ type: "questionnaire", clienteId: profil.id, prenom }));
  return { envoye: true };
}
