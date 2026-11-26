"use server";

import { revalidatePath } from "next/cache";
import { SESSION_PERDUE, sessionCoach } from "../clientes/verification";

export type EtatOffre = { erreur?: string; succes?: string };
const PRIX = /^price_[A-Za-z0-9]+$/;

/** Réglages de l'offre abonnées : ouverte ou non, textes, prix Stripe (identifiants « price_… »), conditions de vente. */
export async function enregistrerOffre(_e: EtatOffre, formData: FormData): Promise<EtatOffre> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const champ = (n: string) => String(formData.get(n) ?? "").trim();
  const titre = champ("titre").slice(0, 120);
  const texte = champ("texte").slice(0, 1500);
  const mensuel = champ("prix_mensuel") || null;
  const annuel = champ("prix_annuel") || null;
  const cgv = champ("lien_cgv") || null;
  const actif = formData.get("actif") === "on";
  if (!titre) return { erreur: "Donne un titre à ton offre." };
  if ((mensuel && !PRIX.test(mensuel)) || (annuel && !PRIX.test(annuel))) return { erreur: "Les prix Stripe commencent par « price_ » (copie l’identifiant du prix dans Stripe)." };
  if (cgv && !cgv.startsWith("https://")) return { erreur: "Le lien des conditions de vente doit commencer par https://" };
  if (actif && !mensuel && !annuel) return { erreur: "Ajoute au moins un prix avant d’ouvrir les inscriptions." };
  if (actif && !cgv) return { erreur: "Ajoute le lien de tes conditions de vente avant d’ouvrir les inscriptions." };
  const { error } = await session.supabase
    .from("reglages")
    .update({ abonnement_actif: actif, abonnement_titre: titre, abonnement_texte: texte, abonnement_prix_mensuel: mensuel, abonnement_prix_annuel: annuel, lien_cgv: cgv })
    .eq("id", true);
  if (error) return { erreur: ["42703", "PGRST204"].includes(error.code ?? "") ? "Fais d’abord la mise à jour de la base : fichier 0045_abonnees.sql (voir le guide)." : "L’enregistrement a échoué. Réessaie." };
  revalidatePath("/coach/abonnees");
  revalidatePath("/abonnement");
  return { succes: actif ? "Enregistré ✓ Les inscriptions sont ouvertes." : "Enregistré ✓ (inscriptions fermées)" };
}
