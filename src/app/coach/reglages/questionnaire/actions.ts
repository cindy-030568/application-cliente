"use server";

import { revalidatePath } from "next/cache";
import { lireSession } from "@/lib/auth";
import { CIBLES, CODES_OBJECTIF, TYPES_QUESTION, type TypeQuestion } from "@/lib/questionnaire";

export type EtatQuestion = { erreur?: string; succes?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION = "Action annulée : ce navigateur n’est plus connecté à ton espace coach. Recharge la page et reconnecte-toi.";

async function coach() {
  const s = await lireSession();
  return s && s.profil.role === "coach" ? s : null;
}

/** Ajoute (id null) ou modifie une question du questionnaire d'arrivée. */
export async function enregistrerQuestion(id: string | null, formData: FormData): Promise<EtatQuestion> {
  const session = await coach();
  if (!session) return { erreur: SESSION };
  if (id !== null && !UUID.test(id)) return { erreur: "Question introuvable." };
  const type = String(formData.get("type") ?? "") as TypeQuestion;
  if (!(type in TYPES_QUESTION)) return { erreur: "Type de question inconnu." };
  const libelle = String(formData.get("libelle") ?? "").trim().slice(0, 300);
  if (!libelle) return { erreur: "Écris la question." };
  const options = String(formData.get("options") ?? "")
    .split("\n")
    .map((o) => o.trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 40);
  if ((type === "choix" || type === "choix_multiple" || type === "aliments") && options.length < 2) return { erreur: "Donne au moins 2 réponses possibles (une par ligne)." };
  if (type === "objectif" && options.length !== CODES_OBJECTIF.length) {
    return { erreur: "Une question « Objectif » a exactement 4 réponses, dans cet ordre : perte de gras, maintien, prise de muscle, tonification." };
  }
  const ligne = {
    libelle,
    type,
    section: String(formData.get("section") ?? "").trim().slice(0, 80),
    aide: String(formData.get("aide") ?? "").trim().slice(0, 500) || null,
    options: ["choix", "choix_multiple", "objectif", "aliments"].includes(type) ? options : [],
    obligatoire: formData.get("obligatoire") === "on" && type !== "exclusions",
    actif: formData.get("actif") === "on",
    ordre: Math.max(0, Math.min(10000, Math.round(Number(formData.get("ordre")) || 0))),
  };
  const cibleBrute = String(formData.get("cible") ?? "");
  const cible = cibleBrute in CIBLES && ((type === "date") === (cibleBrute === "date_naissance")) && (type === "nombre" || type === "date") ? cibleBrute : null;
  // Cible et condition (mise à jour 0032) : ajoutées seulement si la colonne existe.
  const complete = { ...ligne, cible, condition: formData.get("condition") === "sport" ? "sport" : null };
  let { error } = id
    ? await session.supabase.from("questions_arrivee").update(complete).eq("id", id)
    : await session.supabase.from("questions_arrivee").insert(complete);
  if (error && ["42703", "PGRST204", "23514"].includes(error.code)) {
    ({ error } = id ? await session.supabase.from("questions_arrivee").update(ligne).eq("id", id) : await session.supabase.from("questions_arrivee").insert(ligne));
  }
  if (error) return { erreur: "L’enregistrement a échoué. As-tu fait la mise à jour 0031 dans Supabase ?" };
  revalidatePath("/coach/reglages/questionnaire");
  return { succes: id ? "Question enregistrée." : "Question ajoutée." };
}

export async function supprimerQuestion(id: string): Promise<EtatQuestion> {
  const session = await coach();
  if (!session) return { erreur: SESSION };
  if (!UUID.test(id)) return { erreur: "Question introuvable." };
  const { error } = await session.supabase.from("questions_arrivee").delete().eq("id", id);
  if (error) return { erreur: "La question n’a pas pu être supprimée." };
  revalidatePath("/coach/reglages/questionnaire");
  return { succes: "Question supprimée. Les réponses déjà reçues ne changent pas." };
}

/** Active ou coupe le questionnaire pour les nouvelles clientes. */
export async function changerQuestionnaireActif(actif: boolean): Promise<EtatQuestion> {
  const session = await coach();
  if (!session) return { erreur: SESSION };
  const { error } = await session.supabase.from("reglages").update({ questionnaire_actif: actif === true }).eq("id", true);
  if (error) return { erreur: "Ça n’a pas fonctionné." };
  revalidatePath("/coach/reglages/questionnaire");
  return { succes: actif ? "Questionnaire activé." : "Questionnaire désactivé." };
}

/** Texte d'accueil du questionnaire. */
export async function enregistrerTexteAccueil(texte: string): Promise<EtatQuestion> {
  const session = await coach();
  if (!session) return { erreur: SESSION };
  const { error } = await session.supabase
    .from("reglages")
    .update({ questionnaire_intro: String(texte ?? "").replace(/\r\n/g, "\n").trim().slice(0, 5000) || null })
    .eq("id", true);
  if (error) return { erreur: "Ça n’a pas fonctionné. As-tu fait la mise à jour 0032 dans Supabase ?" };
  revalidatePath("/coach/reglages/questionnaire");
  return { succes: "Texte d’accueil enregistré." };
}
