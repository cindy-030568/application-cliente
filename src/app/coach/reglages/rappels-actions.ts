"use server";

import { revalidatePath } from "next/cache";
import { lireSession } from "@/lib/auth";
import { SITE_URL } from "@/lib/env";
import { configurationRappels, envoyerEmail, executerRappels } from "@/lib/envoi-rappels";
import { SUJETS, emailRappel, personnaliser } from "@/lib/rappels";
import { createAdminClient } from "@/lib/supabase/admin";

export type EtatRappelsCoach = { erreur?: string; succes?: string };
const SESSION_PERDUE =
  "Action annulée : ce navigateur n’est plus connecté à ton espace coach. Recharge la page et reconnecte-toi.";

async function sessionCoach() {
  const session = await lireSession();
  return session && session.profil.role === "coach" ? session : null;
}

export async function enregistrerRappels(_e: EtatRappelsCoach, formData: FormData): Promise<EtatRappelsCoach> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const relance_jours = Number(formData.get("relance_jours"));
  const texte_rappel = String(formData.get("texte_rappel") ?? "").trim().slice(0, 300);
  const texte_relance = String(formData.get("texte_relance") ?? "").trim().slice(0, 300);
  if (!Number.isInteger(relance_jours) || relance_jours < 0 || relance_jours > 7) {
    return { erreur: "La relance doit être entre 0 (pas de relance) et 7 jours." };
  }
  if (!texte_rappel || !texte_relance) return { erreur: "Les deux messages sont obligatoires." };
  const { error } = await session.supabase
    .from("reglages")
    .update({ rappels_actifs: formData.get("rappels_actifs") === "on", relance_jours, texte_rappel, texte_relance })
    .eq("id", true);
  if (error) return { erreur: "L’enregistrement a échoué. As-tu bien fait la mise à jour de la base (0008) ?" };
  revalidatePath("/coach/reglages");
  return { succes: "Rappels enregistrés." };
}

/** Envoie un email de rappel d'exemple à la coach elle-même : vérifie la clé Brevo. */
export async function emailDeTest(texte: string): Promise<EtatRappelsCoach> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!configurationRappels().email) return { erreur: "La clé Brevo n’est pas encore dans Vercel (BREVO_API_KEY)." };
  try {
    const message = personnaliser(String(texte ?? "").slice(0, 300) || "Ton bilan est prêt.", session.profil.prenom);
    const { html, texte: brut } = emailRappel(message, `${SITE_URL()}/suivi/bilan`, `${SITE_URL()}/profil`);
    await envoyerEmail({ email: session.profil.email, nom: session.profil.prenom, sujet: `[Test] ${SUJETS.ouverture}`, html, texte: brut });
    return { succes: "Email de test envoyé : regarde ta boîte (et les spams)." };
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return {
      erreur: m.includes("401")
        ? "Brevo refuse la clé : vérifie BREVO_API_KEY dans Vercel, et dans Brevo → Sécurité → IP autorisées, désactive le blocage des adresses IP inconnues."
        : m.includes("expéditeur")
          ? "Aucun expéditeur validé dans Brevo."
          : "L’email n’est pas parti. Réessaie dans un moment.",
    };
  }
}

/** Lance tout de suite la tâche du matin (les rappels déjà envoyés ne repartent jamais). */
export async function lancerRappelsMaintenant(): Promise<EtatRappelsCoach> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  try {
    const b = await executerRappels(createAdminClient());
    revalidatePath("/coach", "layout");
    if (!b.actifs) return { succes: "Les rappels sont en pause : rien n’a été envoyé." };
    if (b.rappels === 0) return { succes: "Aucun rappel à envoyer aujourd’hui : tout le monde est à jour." };
    return {
      succes: `${b.rappels} rappel${b.rappels > 1 ? "s" : ""} : ${b.emails} email${b.emails > 1 ? "s" : ""}, ${b.notifications} notification${b.notifications > 1 ? "s" : ""}.`,
      erreur: b.erreurs ? `${b.erreurs} envoi${b.erreurs > 1 ? "s ont" : " a"} échoué.` : undefined,
    };
  } catch {
    return { erreur: "La tâche n’a pas pu tourner. As-tu bien fait la mise à jour de la base (0008) ?" };
  }
}
