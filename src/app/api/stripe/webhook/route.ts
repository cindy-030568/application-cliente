import type { SupabaseClient } from "@supabase/supabase-js";
import { aujourdhuiParis } from "@/lib/bilan";
import { etatDepuisStripe, signatureStripeValide, type AbonnementStripe } from "@/lib/abonnement";
import { appliquerEtat } from "@/lib/abonnees-serveur";
import { SITE_URL } from "@/lib/env";
import { lireAbonnementStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEmailClient } from "@/lib/supabase/server";

/**
 * Messages de Stripe (webhook) : paiement d'un abonnement, renouvellement, résiliation.
 * Chaque message est vérifié avec STRIPE_WEBHOOK_SECRET : sans signature valide, rien ne se passe.
 * Ce qui est fait :
 *  - abonnement payé → compte de l'abonnée créé (ou rouvert) et email de connexion ;
 *  - abonnement modifié / renouvelé / arrêté → accès ouvert ou fermé, fin de période à jour.
 * Répond 200 dès que c'est traité (ou ignoré), 500 si la base n'a pas pu être mise à jour (Stripe réessaie).
 */
export async function POST(request: Request) {
  const corps = await request.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!signatureStripeValide(corps, request.headers.get("stripe-signature"), secret)) {
    return Response.json({ erreur: "signature invalide" }, { status: 400 });
  }
  let evenement: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    evenement = JSON.parse(corps);
  } catch {
    return Response.json({ erreur: "message illisible" }, { status: 400 });
  }
  const objet = evenement.data?.object ?? {};
  try {
    const admin = createAdminClient();
    if (evenement.type === "checkout.session.completed" && objet.mode === "subscription") {
      await paiementTermine(admin, objet);
    } else if (evenement.type?.startsWith("customer.subscription.")) {
      await abonnementModifie(admin, objet as unknown as AbonnementStripe);
    }
    return Response.json({ recu: true });
  } catch (e) {
    console.error("Webhook Stripe : échec", e instanceof Error ? e.message.slice(0, 200) : "");
    return Response.json({ erreur: "échec" }, { status: 500 });
  }
}

const texte = (v: unknown) => (typeof v === "string" ? v : null);

/** Trouve la fiche d'après Stripe (client ou abonnement), ou d'après l'email. */
async function trouverFiche(admin: SupabaseClient, o: { client?: string | null; abonnement?: string | null; email?: string | null }) {
  for (const [col, val] of [["stripe_subscription_id", o.abonnement], ["stripe_customer_id", o.client]] as const) {
    if (!val) continue;
    const { data } = await admin.from("clientes").select("id, formule, statut").eq(col, val).maybeSingle<{ id: string; formule: string; statut: string }>();
    if (data) return data;
  }
  if (o.email) {
    const { data: p } = await admin.from("profils").select("id").ilike("email", o.email.replace(/[%_\\]/g, "\\$&")).maybeSingle<{ id: string }>();
    if (p) {
      const { data } = await admin.from("clientes").select("id, formule, statut").eq("id", p.id).maybeSingle<{ id: string; formule: string; statut: string }>();
      if (data) return data;
      return { id: p.id, formule: "aucune", statut: "aucun" };
    }
  }
  return null;
}

async function envoyerConnexion(email: string) {
  await createEmailClient().auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${SITE_URL()}/auth/confirm` } });
}

async function paiementTermine(admin: SupabaseClient, s: Record<string, unknown>) {
  const details = (s.customer_details ?? {}) as Record<string, unknown>;
  const email = (texte(details.email) ?? texte(s.customer_email) ?? "").trim().toLowerCase();
  const prenom = (texte((s.metadata as Record<string, unknown> | undefined)?.prenom) ?? "").trim().slice(0, 60);
  const client = texte(s.customer);
  const abonnement = texte(s.subscription);
  if (!abonnement || !client) return;
  const etat = etatDepuisStripe(await lireAbonnementStripe(abonnement));

  const fiche = await trouverFiche(admin, { client, abonnement, email });
  if (fiche && fiche.formule !== "abonnement") {
    // Un compte existe déjà (cliente coachée, ou la coach) : on ne le transforme jamais en abonnée.
    console.warn("Webhook Stripe : paiement d’un compte qui n’est pas une abonnée, à vérifier dans Stripe.");
    return;
  }
  let id = fiche?.id ?? null;
  let nouveau = false;
  if (!id) {
    if (!email) return;
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { prenom } });
    if (error || !data.user) throw new Error("création du compte impossible");
    id = data.user.id;
    nouveau = true;
    const { error: e2 } = await admin.from("clientes").insert({
      id,
      statut: "active",
      formule: "abonnement",
      date_debut: aujourdhuiParis(),
      journal_actif: false,
      cgv_acceptees_le: new Date().toISOString(),
      renonciation_retractation: true,
    });
    if (e2) {
      await admin.auth.admin.deleteUser(id);
      throw new Error("création de la fiche impossible");
    }
  } else if (fiche?.statut === "fermee") {
    // Elle revient : on rouvre (conditions acceptées à nouveau sur la page d'abonnement).
    await admin.from("clientes").update({ cgv_acceptees_le: new Date().toISOString(), renonciation_retractation: true }).eq("id", id);
  }
  if (etat) {
    const { error } = await appliquerEtat(admin, id, etat, { client, abonnement });
    if (error) throw new Error("mise à jour de l’abonnement impossible");
  }
  if ((nouveau || fiche?.statut === "fermee") && email) await envoyerConnexion(email).catch(() => {});
}

async function abonnementModifie(admin: SupabaseClient, a: AbonnementStripe) {
  const etat = etatDepuisStripe(a);
  if (!etat || !a.id) return;
  const fiche = await trouverFiche(admin, { client: a.customer, abonnement: a.id });
  if (!fiche || fiche.formule !== "abonnement") return;
  const { error } = await appliquerEtat(admin, fiche.id, etat, { client: a.customer, abonnement: a.id });
  if (error) throw new Error("mise à jour de l’abonnement impossible");
}
