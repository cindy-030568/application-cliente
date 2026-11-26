"use server";

import { redirect } from "next/navigation";
import { exigerAbonnee } from "@/lib/auth";
import { SITE_URL } from "@/lib/env";
import { creerSessionPortail } from "@/lib/stripe";

export type EtatEspace = { erreur?: string };

/** « Gérer mon abonnement » : l'espace sécurisé de Stripe (carte, factures, formule, résiliation). */
export async function gererAbonnement(): Promise<EtatEspace> {
  const { fiche } = await exigerAbonnee();
  if (!fiche.stripe_customer_id) return { erreur: "Ton abonnement est introuvable. Écris-moi, je regarde tout de suite." };
  let url: string;
  try {
    url = await creerSessionPortail(fiche.stripe_customer_id, `${SITE_URL()}/espace`);
  } catch {
    return { erreur: "L’espace de gestion ne s’ouvre pas pour le moment. Réessaie dans un instant." };
  }
  redirect(url);
}

/** Consentement de l'abonnée (même version que les clientes coachées, texte adapté). */
export async function accepterConsentementAbonnee(formData: FormData) {
  if (formData.get("accord") !== "oui") redirect("/espace/bienvenue?manque=1");
  const { supabase, profil, reglages } = await exigerAbonnee(false);
  const { error } = await supabase
    .from("consentements")
    .upsert({ cliente_id: profil.id, version: reglages.version_consentement }, { onConflict: "cliente_id,version", ignoreDuplicates: true });
  if (error) redirect("/espace/bienvenue?erreur=1");
  redirect("/espace");
}
