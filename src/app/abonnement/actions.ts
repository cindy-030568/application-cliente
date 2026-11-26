"use server";

import { redirect } from "next/navigation";
import { lireInscription } from "@/lib/abonnement";
import { lireReglagesAbonnement } from "@/lib/abonnees-serveur";
import { lireSession } from "@/lib/auth";
import { SITE_URL } from "@/lib/env";
import { creerSessionPaiement } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export type EtatInscription = { erreur?: string };

/** Inscription : vérifie le formulaire, puis envoie vers la page de paiement sécurisée de Stripe. */
export async function commencerAbonnement(_e: EtatInscription, formData: FormData): Promise<EtatInscription> {
  const champ = (n: string) => (formData.get(n) === null ? null : String(formData.get(n)));
  const r = lireInscription({ prenom: champ("prenom") ?? "", email: champ("email") ?? "", formule: champ("formule") ?? "", cgv: champ("cgv"), renonciation: champ("renonciation") });
  if (!r.valeurs) return { erreur: r.erreur };
  const { prenom, email, formule } = r.valeurs;

  let url: string;
  try {
    const admin = createAdminClient();
    const reglages = await lireReglagesAbonnement(admin);
    const session = await lireSession();
    const apercu = session?.profil.role === "coach";
    if (!reglages || (!reglages.actif && !apercu)) return { erreur: "Les inscriptions ne sont pas encore ouvertes." };
    const prix = formule === "annuel" ? reglages.prixAnnuel : reglages.prixMensuel;
    if (!prix) return { erreur: "Cette formule n’est pas disponible pour le moment." };

    // Un compte existe déjà avec cet email ?
    const { data: profil } = await admin.from("profils").select("id").ilike("email", email.replace(/[%_\\]/g, "\\$&")).maybeSingle<{ id: string }>();
    let client: string | null = null;
    if (profil) {
      const { data: fiche } = await admin.from("clientes").select("formule, statut, stripe_customer_id").eq("id", profil.id).maybeSingle<{ formule: string; statut: string; stripe_customer_id: string | null }>();
      // Une ancienne abonnée revient : on reprend son compte Stripe. Sinon : elle a déjà un compte.
      if (fiche?.formule === "abonnement" && fiche.statut === "fermee") client = fiche.stripe_customer_id;
      else return { erreur: "Un compte existe déjà avec cette adresse email : connecte-toi pour retrouver ton espace." };
    }
    url = await creerSessionPaiement({
      prix,
      formule,
      email,
      client,
      prenom,
      retour: `${SITE_URL()}/abonnement/merci`,
      annulation: `${SITE_URL()}/abonnement?annule=1`,
    });
  } catch (e) {
    console.error("Abonnement : échec", e instanceof Error ? e.message.slice(0, 200) : "");
    return { erreur: "Le paiement n’a pas pu être préparé. Réessaie dans un instant." };
  }
  redirect(url);
}
