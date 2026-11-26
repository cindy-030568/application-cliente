import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aujourdhuiParis } from "./bilan";
import type { EtatAbonnement } from "./abonnement";

export type Formule = "coaching" | "abonnement";

/** La formule d'un compte (« coaching » avant la mise à jour 0045, ou si elle n'est pas lisible). */
export async function lireFormule(supabase: SupabaseClient, id: string): Promise<Formule> {
  const { data, error } = await supabase.from("clientes").select("formule").eq("id", id).maybeSingle<{ formule: Formule }>();
  return !error && data?.formule === "abonnement" ? "abonnement" : "coaching";
}

/** Identifiants des abonnées (pour les écarter des automatismes du coaching). Vide avant 0045. */
export async function idsAbonnees(admin: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await admin.from("clientes").select("id").eq("formule", "abonnement");
  return new Set(error ? [] : (data ?? []).map((c) => c.id as string));
}

export type ReglagesAbonnement = {
  actif: boolean;
  prixMensuel: string | null;
  prixAnnuel: string | null;
  titre: string;
  texte: string;
  lienCgv: string | null;
  lienCoaching: string | null;
};

/** Réglages de l'offre (lecture serveur : la page publique n'a pas de session). null avant 0045. */
export async function lireReglagesAbonnement(admin: SupabaseClient): Promise<ReglagesAbonnement | null> {
  const { data, error } = await admin
    .from("reglages")
    .select("abonnement_actif, abonnement_prix_mensuel, abonnement_prix_annuel, abonnement_titre, abonnement_texte, lien_cgv, lien_inscription")
    .maybeSingle<{
      abonnement_actif: boolean;
      abonnement_prix_mensuel: string | null;
      abonnement_prix_annuel: string | null;
      abonnement_titre: string;
      abonnement_texte: string;
      lien_cgv: string | null;
      lien_inscription: string | null;
    }>();
  if (error || !data) return null;
  return {
    actif: data.abonnement_actif,
    prixMensuel: data.abonnement_prix_mensuel,
    prixAnnuel: data.abonnement_prix_annuel,
    titre: data.abonnement_titre,
    texte: data.abonnement_texte,
    lienCgv: data.lien_cgv,
    lienCoaching: data.lien_inscription,
  };
}

export type FicheAbonnee = {
  id: string;
  statut: "active" | "terminee" | "fermee";
  formule: Formule;
  stripe_customer_id: string | null;
  abonnement_statut: string | null;
  abonnement_formule: string | null;
  abonnement_fin_periode: string | null;
  abonnement_resilie: boolean;
};
export const COLONNES_ABONNEE = "id, statut, formule, stripe_customer_id, abonnement_statut, abonnement_formule, abonnement_fin_periode, abonnement_resilie";

/** Applique l'état d'un abonnement Stripe à la fiche de l'abonnée (accès ouvert ou fermé). */
export async function appliquerEtat(admin: SupabaseClient, clienteId: string, e: EtatAbonnement, ids: { client?: string; abonnement?: string }) {
  const { data: avant } = await admin.from("clientes").select("statut, ferme_le").eq("id", clienteId).maybeSingle<{ statut: string; ferme_le: string | null }>();
  return admin
    .from("clientes")
    .update({
      ...e,
      ...(ids.client ? { stripe_customer_id: ids.client } : {}),
      ...(ids.abonnement ? { stripe_subscription_id: ids.abonnement } : {}),
      // Fermée : la date compte pour les 6 mois de conservation. Rouverte : on l'efface.
      ferme_le: e.statut === "fermee" ? (avant?.statut === "fermee" && avant.ferme_le ? avant.ferme_le : aujourdhuiParis()) : null,
    })
    .eq("id", clienteId)
    .eq("formule", "abonnement");
}
