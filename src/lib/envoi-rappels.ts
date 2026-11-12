import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { aujourdhuiParis } from "@/lib/bilan";
import { SITE_URL } from "@/lib/env";
import { SUJETS, cleRappel, emailRappel, personnaliser, rappelDu, type TypeRappel } from "@/lib/rappels";

/** Ce qui est configuré dans Vercel (sans jamais exposer les valeurs). */
export function configurationRappels() {
  return {
    email: Boolean(process.env.BREVO_API_KEY),
    push: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    tache: Boolean(process.env.CRON_SECRET),
  };
}

// ---------------------------------------------------------------- Email (Brevo)

/** Erreur renvoyée par Brevo, avec son code HTTP et sa raison (en anglais). */
export class ErreurBrevo extends Error {
  constructor(
    public etape: "expediteurs" | "envoi",
    public statut: number,
    public raison: string,
  ) {
    super(`Brevo ${etape} ${statut} : ${raison}`);
  }
}

async function raisonBrevo(r: Response): Promise<string> {
  try {
    const corps = (await r.json()) as { code?: string; message?: string };
    return [corps.code, corps.message].filter(Boolean).join(" — ").slice(0, 300) || r.statusText;
  } catch {
    return r.statusText;
  }
}

let expediteurEnCache: { name: string; email: string } | null = null;

/** Expéditeur : variables BREVO_EXPEDITEUR_* si renseignées, sinon le premier expéditeur validé du compte Brevo. */
async function expediteur(cle: string) {
  if (process.env.BREVO_EXPEDITEUR_EMAIL) {
    return { name: process.env.BREVO_EXPEDITEUR_NOM || "Cindy · fitw_cindy", email: process.env.BREVO_EXPEDITEUR_EMAIL };
  }
  if (expediteurEnCache) return expediteurEnCache;
  const r = await fetch("https://api.brevo.com/v3/senders", { headers: { "api-key": cle, accept: "application/json" } });
  if (!r.ok) throw new ErreurBrevo("expediteurs", r.status, await raisonBrevo(r));
  const { senders } = (await r.json()) as { senders?: { name: string; email: string; active: boolean }[] };
  const s = senders?.find((x) => x.active);
  if (!s) throw new Error("Brevo : aucun expéditeur validé");
  expediteurEnCache = { name: s.name || "Cindy · fitw_cindy", email: s.email };
  return expediteurEnCache;
}

export async function envoyerEmail(o: { email: string; nom: string; sujet: string; html: string; texte: string }) {
  const cle = process.env.BREVO_API_KEY;
  if (!cle) throw new Error("Clé Brevo absente");
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": cle, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: await expediteur(cle),
      to: [{ email: o.email, name: o.nom }],
      subject: o.sujet,
      htmlContent: o.html,
      textContent: o.texte,
      tags: ["rappel-bilan"],
    }),
  });
  if (!r.ok) throw new ErreurBrevo("envoi", r.status, await raisonBrevo(r));
}

// ---------------------------------------------------------------- Notifications

export type AbonnementPush = { id: string; endpoint: string; p256dh: string; auth: string };

/** « ok », « expire » (appareil désabonné : à supprimer) ou « erreur ». */
export async function envoyerPush(a: AbonnementPush, contenu: { titre: string; texte: string; url: string }) {
  const publique = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privee = process.env.VAPID_PRIVATE_KEY;
  if (!publique || !privee) return "erreur" as const;
  try {
    await webpush.sendNotification(
      { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
      JSON.stringify({ title: contenu.titre, body: contenu.texte, url: contenu.url }),
      { vapidDetails: { subject: sujetVapid(), publicKey: publique, privateKey: privee }, TTL: 60 * 60 * 12 },
    );
    return "ok" as const;
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) return "expire" as const;
    console.warn("Notification : échec d’envoi", code ?? (e instanceof Error ? e.message.slice(0, 120) : ""));
    return "erreur" as const;
  }
}

/** Contact exigé par les services de notification : l'adresse https de l'app. */
function sujetVapid() {
  const site = SITE_URL();
  return site.startsWith("https://") ? site : "https://fitw-cindy.vercel.app";
}

// ---------------------------------------------------------------- Tâche quotidienne

export type BilanRappels = { examinees: number; rappels: number; emails: number; notifications: number; erreurs: number; actifs: boolean };

type ClienteRappel = {
  id: string;
  statut: string;
  date_debut: string | null;
  frequence_bilan_jours: number;
  rappels_email: boolean;
  profils: { prenom: string; email: string } | { prenom: string; email: string }[];
};

/**
 * Envoie les rappels du jour à toutes les clientes concernées.
 * `admin` : client avec la clé secrète (la tâche n'a pas d'utilisatrice connectée).
 * Chaque rappel est d'abord inscrit au journal (unique par échéance et type) :
 * même lancée deux fois, la tâche n'envoie jamais deux fois le même rappel.
 */
export async function executerRappels(admin: SupabaseClient, aujourdhui = aujourdhuiParis()): Promise<BilanRappels> {
  const bilan: BilanRappels = { examinees: 0, rappels: 0, emails: 0, notifications: 0, erreurs: 0, actifs: true };
  const { data: reglages } = await admin
    .from("reglages")
    .select("rappels_actifs, relance_jours, texte_rappel, texte_relance, fenetre_bilan_jours")
    .single();
  if (!reglages) throw new Error("Réglages introuvables");
  if (!reglages.rappels_actifs) return { ...bilan, actifs: false };

  const { data: clientes } = await admin
    .from("clientes")
    .select("id, statut, date_debut, frequence_bilan_jours, rappels_email, profils!inner(prenom, email)")
    .eq("statut", "active")
    .not("date_debut", "is", null)
    .returns<ClienteRappel[]>();
  if (!clientes?.length) return bilan;
  const ids = clientes.map((c) => c.id);
  const depuis = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);

  const [{ data: bilans }, { data: envoyes }, { data: abonnements }] = await Promise.all([
    admin.from("bilans").select("cliente_id, echeance").in("cliente_id", ids).gte("echeance", depuis),
    admin.from("rappels_envoyes").select("cliente_id, echeance, type, envoye_le").in("cliente_id", ids).gte("echeance", depuis),
    admin.from("abonnements_push").select("id, cliente_id, endpoint, p256dh, auth").in("cliente_id", ids),
  ]);
  const jourParis = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(iso));

  const config = configurationRappels();
  for (const c of clientes) {
    bilan.examinees++;
    const p = Array.isArray(c.profils) ? c.profils[0] : c.profils;
    const rappel = rappelDu({
      statut: c.statut,
      date_debut: c.date_debut,
      frequence_bilan_jours: c.frequence_bilan_jours,
      fenetre: reglages.fenetre_bilan_jours,
      relanceJours: reglages.relance_jours,
      aujourdhui,
      bilansEnvoyes: new Set((bilans ?? []).filter((b) => b.cliente_id === c.id).map((b) => b.echeance as string)),
      rappelsEnvoyes: new Map(
        (envoyes ?? [])
          .filter((r) => r.cliente_id === c.id)
          .map((r) => [cleRappel(r.echeance as string, r.type as TypeRappel), jourParis(r.envoye_le as string)]),
      ),
    });
    if (!rappel) continue;
    const appareils = (abonnements ?? []).filter((a) => a.cliente_id === c.id) as (AbonnementPush & { cliente_id: string })[];
    const emailPossible = config.email && c.rappels_email && Boolean(p?.email);
    if (!emailPossible && !(config.push && appareils.length)) continue; // rien pour la joindre : on réessaiera demain

    // Inscription au journal AVANT l'envoi : protège contre les doublons.
    const { data: ligne, error } = await admin
      .from("rappels_envoyes")
      .insert({ cliente_id: c.id, echeance: rappel.echeance, type: rappel.type })
      .select("id")
      .single();
    if (error || !ligne) continue;
    bilan.rappels++;

    const message = personnaliser(rappel.type === "ouverture" ? reglages.texte_rappel : reglages.texte_relance, p?.prenom ?? "");
    const canaux: string[] = [];
    if (config.push) {
      for (const a of appareils) {
        const r = await envoyerPush(a, { titre: SUJETS[rappel.type], texte: message, url: "/suivi/bilan" });
        if (r === "ok") {
          if (!canaux.includes("push")) canaux.push("push");
          bilan.notifications++;
        } else if (r === "expire") {
          await admin.from("abonnements_push").delete().eq("id", a.id);
        } else bilan.erreurs++;
      }
    }
    if (emailPossible && p?.email) {
      try {
        const { html, texte } = emailRappel(message, `${SITE_URL()}/suivi/bilan`, `${SITE_URL()}/profil`);
        await envoyerEmail({ email: p.email, nom: p.prenom, sujet: SUJETS[rappel.type], html, texte });
        canaux.push("email");
        bilan.emails++;
      } catch {
        bilan.erreurs++;
      }
    }
    if (canaux.length === 0) {
      // Rien n'est parti (erreur d'envoi) : on retire l'inscription pour réessayer au prochain passage.
      await admin.from("rappels_envoyes").delete().eq("id", ligne.id);
      bilan.rappels--;
      continue;
    }
    await admin.from("rappels_envoyes").update({ canaux }).eq("id", ligne.id);
  }
  return bilan;
}

// ---------------------------------------------------------------- Lecture des réglages

export type ReglagesRappels = {
  rappels_actifs: boolean;
  relance_jours: number;
  texte_rappel: string;
  texte_relance: string;
};

/** Réglages des rappels, ou null si la mise à jour de la base (0008) n'a pas encore été faite. */
export async function lireReglagesRappels(supabase: SupabaseClient): Promise<ReglagesRappels | null> {
  const { data, error } = await supabase
    .from("reglages")
    .select("rappels_actifs, relance_jours, texte_rappel, texte_relance")
    .maybeSingle<ReglagesRappels>();
  return error ? null : data;
}
