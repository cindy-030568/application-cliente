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
 * et une cliente sans consentement vers /consentement.
 */
export const exigerCliente = cache(async (verifierConsentement: boolean = true) => {
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

  return { ...session, fiche, reglages };
});
