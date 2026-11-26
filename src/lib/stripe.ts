import "server-only";
import type { AbonnementStripe, FormuleAbonnement } from "./abonnement";

/**
 * Appels à Stripe, côté serveur seulement. Les clés sont dans Vercel (jamais dans le code) :
 * STRIPE_SECRET_KEY (clé secrète, ou mieux une clé restreinte) et STRIPE_WEBHOOK_SECRET (signature des messages).
 * STRIPE_API_URL ne sert qu'aux tests (Stripe simulé).
 */
export function configurationStripe() {
  return { cle: Boolean(process.env.STRIPE_SECRET_KEY), webhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET), test: (process.env.STRIPE_SECRET_KEY ?? "").includes("_test_") };
}

const API = () => (process.env.STRIPE_API_URL || "https://api.stripe.com").replace(/\/+$/, "");

/** Encode des paramètres comme Stripe les attend : a[b][0][c]=… */
export function encoderParametres(p: Record<string, unknown>, prefixe = ""): string[] {
  const sortie: string[] = [];
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null) continue;
    const cle = prefixe ? `${prefixe}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === "object" ? sortie.push(...encoderParametres(x as Record<string, unknown>, `${cle}[${i}]`)) : sortie.push(`${encodeURIComponent(`${cle}[${i}]`)}=${encodeURIComponent(String(x))}`)));
    else if (typeof v === "object") sortie.push(...encoderParametres(v as Record<string, unknown>, cle));
    else sortie.push(`${encodeURIComponent(cle)}=${encodeURIComponent(String(v))}`);
  }
  return sortie;
}

async function appel<T>(methode: "GET" | "POST", chemin: string, params?: Record<string, unknown>, cache?: RequestInit["next"]): Promise<T> {
  const cle = process.env.STRIPE_SECRET_KEY;
  if (!cle) throw new Error("Stripe n’est pas configuré (clé STRIPE_SECRET_KEY absente dans Vercel).");
  const corps = params ? encoderParametres(params).join("&") : undefined;
  const r = await fetch(`${API()}/v1/${chemin}`, {
    method: methode,
    headers: { Authorization: `Bearer ${cle}`, ...(corps ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: methode === "POST" ? corps : undefined,
    ...(cache ? { next: cache } : { cache: "no-store" }),
  });
  const json = (await r.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!r.ok) throw new Error(`Stripe : ${json.error?.message ?? r.status}`);
  return json;
}

export type PrixStripe = { id: string; unit_amount: number | null; currency: string; recurring: { interval: string } | null; active: boolean };

/** Prix (montant, devise, période), gardé en cache une heure. null si introuvable ou Stripe non configuré. */
export async function lirePrix(id: string | null): Promise<PrixStripe | null> {
  if (!id || !process.env.STRIPE_SECRET_KEY) return null;
  try {
    return await appel<PrixStripe>("GET", `prices/${encodeURIComponent(id)}`, undefined, { revalidate: 3600 });
  } catch {
    return null;
  }
}

/** Page de paiement sécurisée de Stripe pour un abonnement. */
export async function creerSessionPaiement(o: {
  prix: string;
  formule: FormuleAbonnement;
  email?: string;
  client?: string | null;
  prenom: string;
  retour: string;
  annulation: string;
}): Promise<string> {
  const s = await appel<{ url: string }>("POST", "checkout/sessions", {
    mode: "subscription",
    line_items: [{ price: o.prix, quantity: 1 }],
    ...(o.client ? { customer: o.client } : { customer_email: o.email }),
    locale: "fr",
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    metadata: { prenom: o.prenom, formule: o.formule },
    subscription_data: { metadata: { prenom: o.prenom } },
    success_url: o.retour,
    cancel_url: o.annulation,
  });
  return s.url;
}

/** Espace sécurisé de Stripe où l'abonnée gère carte, factures, formule et résiliation. */
export async function creerSessionPortail(client: string, retour: string): Promise<string> {
  const s = await appel<{ url: string }>("POST", "billing_portal/sessions", { customer: client, return_url: retour });
  return s.url;
}

export async function lireAbonnementStripe(id: string): Promise<AbonnementStripe> {
  return appel<AbonnementStripe>("GET", `subscriptions/${encodeURIComponent(id)}`);
}
