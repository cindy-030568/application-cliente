/**
 * Espace abonnées : logique pure, testée (signature des messages de Stripe, état d'un abonnement,
 * prix affichés, formulaire d'inscription, conservation des données).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type FormuleAbonnement = "mensuel" | "annuel";
export const FORMULES: FormuleAbonnement[] = ["mensuel", "annuel"];

/** Données gardées 6 mois après l'arrêt, puis effacées. */
export const MOIS_CONSERVATION = 6;

/**
 * Vérifie qu'un message vient bien de Stripe (en-tête « Stripe-Signature » : t=…,v1=…).
 * Refusé s'il a plus de 5 minutes (protection contre le rejeu).
 */
export function signatureStripeValide(corps: string, entete: string | null, secret: string, maintenantS = Math.floor(Date.now() / 1000), toleranceS = 300): boolean {
  if (!entete || !secret) return false;
  const parties = entete.split(",").map((p) => p.trim().split("="));
  const t = Number(parties.find(([k]) => k === "t")?.[1]);
  const signatures = parties.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(t) || !signatures.length || Math.abs(maintenantS - t) > toleranceS) return false;
  const attendue = Buffer.from(createHmac("sha256", secret).update(`${t}.${corps}`).digest("hex"));
  return signatures.some((s) => {
    const recue = Buffer.from(s ?? "");
    return recue.length === attendue.length && timingSafeEqual(recue, attendue);
  });
}

/** Pour les tests : l'en-tête que Stripe enverrait. */
export function signerCommeStripe(corps: string, secret: string, t = Math.floor(Date.now() / 1000)): string {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${corps}`).digest("hex")}`;
}

/** Date à Paris (AAAA-MM-JJ) d'un instant Stripe (secondes). */
export function dateParisDe(secondes: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(secondes * 1000));
}

/** Ce que Stripe renvoie d'un abonnement (les champs utiles, anciens et nouveaux formats). */
export type AbonnementStripe = {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  metadata?: Record<string, string>;
  items?: { data?: { current_period_end?: number; price?: { id?: string; recurring?: { interval?: string } | null } }[] };
};

export type EtatAbonnement = {
  /** Accès à l'application : « active » tant que l'abonnement court (même pendant une relance de paiement). */
  statut: "active" | "fermee";
  abonnement_statut: string;
  abonnement_formule: FormuleAbonnement | null;
  abonnement_fin_periode: string | null;
  abonnement_resilie: boolean;
};

const STATUTS_AVEC_ACCES = ["active", "trialing", "past_due"];
const STATUTS_FINIS = ["canceled", "unpaid", "incomplete_expired"];

/** Traduit un abonnement Stripe en accès dans l'app. null : rien à changer encore (paiement en cours). */
export function etatDepuisStripe(a: AbonnementStripe): EtatAbonnement | null {
  if (!STATUTS_AVEC_ACCES.includes(a.status) && !STATUTS_FINIS.includes(a.status)) return null;
  const article = a.items?.data?.[0];
  const fin = a.current_period_end ?? article?.current_period_end;
  const intervalle = article?.price?.recurring?.interval;
  return {
    statut: STATUTS_AVEC_ACCES.includes(a.status) ? "active" : "fermee",
    abonnement_statut: a.status,
    abonnement_formule: intervalle === "year" ? "annuel" : intervalle === "month" ? "mensuel" : null,
    abonnement_fin_periode: fin ? dateParisDe(fin) : null,
    abonnement_resilie: Boolean(a.cancel_at_period_end),
  };
}

/** 990 EUR mois → « 9,90 € / mois ». */
export function textePrix(p: { unit_amount: number | null; currency: string; recurring?: { interval?: string } | null } | null): string | null {
  if (!p || p.unit_amount === null) return null;
  const montant = new Intl.NumberFormat("fr-FR", { style: "currency", currency: p.currency.toUpperCase() }).format(p.unit_amount / 100);
  const periode = p.recurring?.interval === "year" ? "an" : p.recurring?.interval === "month" ? "mois" : null;
  return periode ? `${montant} / ${periode}` : montant;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Formulaire d'inscription (page publique). */
export function lireInscription(f: { prenom?: string; email?: string; formule?: string; cgv?: string | null; renonciation?: string | null }):
  | { valeurs: { prenom: string; email: string; formule: FormuleAbonnement }; erreur?: undefined }
  | { valeurs?: undefined; erreur: string } {
  const prenom = (f.prenom ?? "").trim().slice(0, 60);
  const email = (f.email ?? "").trim().toLowerCase().slice(0, 200);
  if (!prenom) return { erreur: "Indique ton prénom." };
  if (!EMAIL.test(email)) return { erreur: "Ton adresse email ne semble pas valide." };
  if (!FORMULES.includes(f.formule as FormuleAbonnement)) return { erreur: "Choisis ta formule : au mois ou à l’année." };
  if (f.cgv !== "on") return { erreur: "Merci d’accepter les conditions de vente." };
  if (f.renonciation !== "on") return { erreur: "Pour accéder à ton espace tout de suite, coche la demande d’accès immédiat." };
  return { valeurs: { prenom, email, formule: f.formule as FormuleAbonnement } };
}

/** L'abonnée fermée depuis plus de 6 mois : ses données sont à effacer. */
export function conservationAbonneeDepassee(fermeLe: string | null, aujourdhui: string): boolean {
  if (!fermeLe) return false;
  const [a, m, j] = fermeLe.split("-").map(Number);
  const limite = new Date(Date.UTC(a, m - 1 + MOIS_CONSERVATION, j));
  return aujourdhui >= limite.toISOString().slice(0, 10);
}

/** Phrase de l'abonnement pour l'abonnée. */
export function texteMonAbonnement(e: { statut: string; abonnement_formule: string | null; abonnement_fin_periode: string | null; abonnement_resilie: boolean; abonnement_statut: string | null }, formaterDate: (d: string) => string): string {
  const formule = e.abonnement_formule === "annuel" ? "à l’année" : e.abonnement_formule === "mensuel" ? "au mois" : "";
  const fin = e.abonnement_fin_periode ? formaterDate(e.abonnement_fin_periode) : null;
  if (e.statut === "fermee") return "Ton abonnement est terminé.";
  if (e.abonnement_statut === "past_due") return "Le dernier paiement n’est pas passé : mets ta carte à jour pour garder ton accès.";
  if (e.abonnement_resilie) return `Abonnement ${formule} arrêté : tu gardes ton accès jusqu’au ${fin ?? "terme de la période payée"}.`;
  return `Abonnement ${formule}${fin ? `, prochain renouvellement le ${fin}` : ""}.`.replace("  ", " ");
}
