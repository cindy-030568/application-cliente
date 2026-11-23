import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COLONNES_FICHE, type FicheCliente, type Profil, type Reglages } from "@/lib/types";

/** Lit la session et le profil (une seule fois par requête). */
export const lireSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) return null;
  const { data: profil } = await supabase
    .from("profils")
    .select("id, role, prenom, nom, email")
    .eq("id", uid)
    .maybeSingle<Profil>();
  if (!profil) return null;
  return { supabase, profil };
});

export async function exigerConnexion() {
  const session = await lireSession();
  if (!session) redirect("/connexion");
  return session;
}

/** Réservé à la coach : à appeler en tête de chaque page ET de chaque action coach. */
export async function exigerCoach() {
  const session = await exigerConnexion();
  if (session.profil.role !== "coach") redirect("/");
  return session;
}

export const lireReglages = cache(async () => {
  const session = await exigerConnexion();
  const { data } = await session.supabase
    .from("reglages")
    .select(
      "version_consentement, lien_politique, lien_formation, message_formation, lien_contact, tolerance_pct, tolerance_g, hors_tolerance, fenetre_bilan_jours, intro_bilan",
    )
    .single<Reglages>();
  if (!data) throw new Error("Réglages introuvables : la migration a-t-elle été exécutée ?");
  return data;
});

/**
 * Réservé aux clientes dont l'accès est ouvert.
 * Renvoie la coach vers son dashboard, une cliente fermée vers /acces-ferme,
 * une cliente sans consentement vers /consentement, puis, à la première connexion,
 * vers /contrat (contrat à accepter) et /questionnaire (questionnaire d'arrivée).
 */
export const exigerCliente = cache(async (
  verifierConsentement: boolean = true,
  verifierContrat: boolean = verifierConsentement,
  verifierQuestionnaire: boolean = verifierContrat,
) => {
  const session = await exigerConnexion();
  if (session.profil.role === "coach") redirect("/coach");

  const { data: fiche } = await session.supabase
    .from("clientes")
    .select(
      COLONNES_FICHE,
    )
    .eq("id", session.profil.id)
    .maybeSingle<FicheCliente>();
  if (!fiche || fiche.statut === "fermee") redirect("/acces-ferme");

  const reglages = await lireReglages();
  if (verifierConsentement) {
    const { data: consentement } = await session.supabase
      .from("consentements")
      .select("id")
      .eq("cliente_id", session.profil.id)
      .eq("version", reglages.version_consentement)
      .maybeSingle();
    if (!consentement) redirect("/consentement");
  }
  if (verifierContrat) {
    // Contrat (mise à jour 0027) : sans la fonction, rien ne bloque.
    const { data: version } = await session.supabase.rpc("contrat_a_accepter");
    if (typeof version === "string" && version) redirect("/contrat");
  }
  if (verifierQuestionnaire) {
    // Questionnaire d'arrivée (mise à jour 0031) : sans la fonction, rien ne bloque.
    const { data: aRemplir } = await session.supabase.rpc("questionnaire_a_remplir");
    if (aRemplir === true) redirect("/questionnaire");
  }

  return { ...session, fiche, reglages };
});
