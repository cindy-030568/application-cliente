import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { ajouterJours, aujourdhuiParis, bilanAvecPhotos } from "@/lib/bilan";
import { messagePaiement } from "@/lib/paiements";
import { heureParis, rappelJournalDu } from "@/lib/journal";
import { SITE_URL } from "@/lib/env";
import { SUJETS, cleRappel, emailRappel, personnaliser, rappelDu, type TypeRappel } from "@/lib/rappels";
import { recapADonner, texteNotificationRecap } from "@/lib/recap-semaine";
import { rappelComplementsDu, texteRappelComplements } from "@/lib/complements";
import { chargerRecaps } from "@/lib/recap-semaine-serveur";
import { HEURES_NOTIF_DEFIS, texteAnnonceDefi, texteReussiteDefi } from "@/lib/defis";
import { idsAbonnees } from "@/lib/abonnees-serveur";
import { conservationAbonneeDepassee } from "@/lib/abonnement";

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

/**
 * Expéditeur : variables BREVO_EXPEDITEUR_* si renseignées ; sinon un expéditeur validé
 * du compte Brevo, de préférence sur le domaine de l'app (ex. @fitw-cindy.fr pour app.fitw-cindy.fr).
 */
async function expediteur(cle: string) {
  if (process.env.BREVO_EXPEDITEUR_EMAIL) {
    return { name: process.env.BREVO_EXPEDITEUR_NOM || "Cindy · fitw_cindy", email: process.env.BREVO_EXPEDITEUR_EMAIL };
  }
  if (expediteurEnCache) return expediteurEnCache;
  const r = await fetch("https://api.brevo.com/v3/senders", { headers: { "api-key": cle, accept: "application/json" } });
  if (!r.ok) throw new ErreurBrevo("expediteurs", r.status, await raisonBrevo(r));
  const { senders } = (await r.json()) as { senders?: { name: string; email: string; active: boolean }[] };
  const actifs = (senders ?? []).filter((x) => x.active);
  const s = actifs.find((x) => surDomaineDuSite(x.email)) ?? actifs[0];
  if (!s) throw new Error("Brevo : aucun expéditeur validé");
  expediteurEnCache = { name: s.name || "Cindy · fitw_cindy", email: s.email };
  return expediteurEnCache;
}

/** Vrai si l'adresse est sur le domaine du site (app.fitw-cindy.fr → @fitw-cindy.fr). */
export function surDomaineDuSite(email: string, site = SITE_URL()): boolean {
  const domaine = email.split("@")[1]?.toLowerCase();
  if (!domaine) return false;
  let hote: string;
  try {
    hote = new URL(site).hostname.toLowerCase();
  } catch {
    return false;
  }
  return hote === domaine || hote.endsWith(`.${domaine}`);
}

export async function envoyerEmail(o: { email: string; nom: string; sujet: string; html: string; texte: string }) {
  const cle = process.env.BREVO_API_KEY;
  if (!cle) throw new Error("Clé Brevo absente");
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": cle, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: await expediteur(cle),
      // Brevo refuse un nom vide : on ne l'envoie que s'il existe.
      to: [o.nom.trim() ? { email: o.email, name: o.nom.trim() } : { email: o.email }],
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

  const { data: toutes } = await admin
    .from("clientes")
    .select("id, statut, date_debut, frequence_bilan_jours, rappels_email, profils!inner(prenom, email)")
    .eq("statut", "active")
    .not("date_debut", "is", null)
    .returns<ClienteRappel[]>();
  // Les abonnées (sans coaching) n'ont pas de bilans.
  const abonnees = await idsAbonnees(admin);
  const clientes = (toutes ?? []).filter((c) => !abonnees.has(c.id));
  if (!clientes.length) return bilan;
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

    const message =
      personnaliser(rappel.type === "ouverture" ? reglages.texte_rappel : reglages.texte_relance, p?.prenom ?? "") +
      (bilanAvecPhotos(c.date_debut, c.frequence_bilan_jours, rappel.echeance) ? " Cette fois, pense aussi à tes photos de suivi 📸" : "");
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

// ---------------------------------------------------------------- Rappels de paiement

export type BilanPaiements = { rappels: number; emails: number; notifications: number; erreurs: number };

/**
 * Le matin de chaque échéance non payée, prévient la cliente (email + notification),
 * si la coach a laissé le rappel activé pour elle. Rattrapage de 2 jours si la tâche
 * n'a pas tourné. Chaque échéance n'est rappelée qu'une fois.
 */
export async function executerRappelsPaiement(admin: SupabaseClient, aujourdhui = aujourdhuiParis()): Promise<BilanPaiements> {
  const bilan: BilanPaiements = { rappels: 0, emails: 0, notifications: 0, erreurs: 0 };
  const { data: echeances, error } = await admin
    .from("echeances_paiement")
    .select("id, cliente_id, date_echeance, montant")
    .is("payee_le", null)
    .is("rappel_envoye_le", null)
    .gte("date_echeance", ajouterJours(aujourdhui, -2))
    .lte("date_echeance", aujourdhui);
  if (error || !echeances?.length) return bilan; // rien à faire (ou mise à jour 0011 pas encore faite)
  const ids = [...new Set(echeances.map((e) => e.cliente_id as string))];
  const [{ data: reglagesPaiement }, { data: clientes }, { data: abonnements }] = await Promise.all([
    admin.from("paiements_clientes").select("cliente_id, rappels").in("cliente_id", ids),
    admin
      .from("clientes")
      .select("id, statut, rappels_email, profils!inner(prenom, email)")
      .in("id", ids)
      .neq("statut", "fermee")
      .returns<Pick<ClienteRappel, "id" | "statut" | "rappels_email" | "profils">[]>(),
    admin.from("abonnements_push").select("id, cliente_id, endpoint, p256dh, auth").in("cliente_id", ids),
  ]);
  const config = configurationRappels();
  for (const e of echeances) {
    if (reglagesPaiement?.find((r) => r.cliente_id === e.cliente_id)?.rappels === false) continue;
    const c = clientes?.find((x) => x.id === e.cliente_id);
    if (!c) continue;
    const p = Array.isArray(c.profils) ? c.profils[0] : c.profils;
    const appareils = (abonnements ?? []).filter((a) => a.cliente_id === c.id) as AbonnementPush[];
    const emailPossible = config.email && c.rappels_email && Boolean(p?.email);
    if (!emailPossible && !(config.push && appareils.length)) continue;

    // Réservation avant l'envoi : jamais deux rappels pour la même échéance.
    const { data: reservee } = await admin
      .from("echeances_paiement")
      .update({ rappel_envoye_le: new Date().toISOString() })
      .eq("id", e.id)
      .is("rappel_envoye_le", null)
      .select("id")
      .maybeSingle();
    if (!reservee) continue;
    bilan.rappels++;

    const message = messagePaiement(p?.prenom ?? "", Number(e.montant), e.date_echeance as string, aujourdhui);
    let parti = false;
    if (config.push) {
      for (const a of appareils) {
        const r = await envoyerPush(a, { titre: "Ta mensualité", texte: message, url: "/profil" });
        if (r === "ok") {
          parti = true;
          bilan.notifications++;
        } else if (r === "expire") await admin.from("abonnements_push").delete().eq("id", a.id);
        else bilan.erreurs++;
      }
    }
    if (emailPossible && p?.email) {
      try {
        const { html, texte } = emailRappel(message, `${SITE_URL()}/profil`, `${SITE_URL()}/profil`, "Voir mon échéancier");
        await envoyerEmail({ email: p.email, nom: p.prenom, sujet: "Rappel : ta mensualité fitw_cindy", html, texte });
        parti = true;
        bilan.emails++;
      } catch {
        bilan.erreurs++;
      }
    }
    if (!parti) {
      await admin.from("echeances_paiement").update({ rappel_envoye_le: null }).eq("id", e.id);
      bilan.rappels--;
    }
  }
  return bilan;
}

/**
 * Abonnées : 6 mois après l'arrêt de l'abonnement, le compte et toutes ses données sont effacés
 * (décision de la coach : on garde 6 mois pour qu'elle retrouve tout si elle revient).
 */
export async function effacerAnciennesAbonnees(admin: SupabaseClient, aujourdhui = aujourdhuiParis()): Promise<number> {
  const { data, error } = await admin.from("clientes").select("id, ferme_le").eq("formule", "abonnement").eq("statut", "fermee");
  if (error) return 0; // mise à jour 0045 pas encore faite
  let effacees = 0;
  for (const c of data ?? []) {
    if (!conservationAbonneeDepassee(c.ferme_le as string | null, aujourdhui)) continue;
    const { error: e } = await admin.auth.admin.deleteUser(c.id as string);
    if (!e) effacees++;
  }
  return effacees;
}

/** Tâche du matin complète : rappels de bilan, rappels de paiement, puis effacement des anciennes abonnées. */
export async function executerTachesDuMatin(admin: SupabaseClient, aujourdhui = aujourdhuiParis()) {
  const bilans = await executerRappels(admin, aujourdhui);
  let paiements: BilanPaiements = { rappels: 0, emails: 0, notifications: 0, erreurs: 0 };
  try {
    paiements = await executerRappelsPaiement(admin, aujourdhui);
  } catch (e) {
    console.warn("Rappels de paiement : échec", e instanceof Error ? e.message.slice(0, 120) : "");
  }
  const abonneesEffacees = await effacerAnciennesAbonnees(admin, aujourdhui).catch(() => 0);
  return { ...bilans, paiements, abonneesEffacees };
}

// ---------------------------------------------------------------- Rappel du journal (toutes les 15 min)

/**
 * Envoie le rappel du journal aux clientes dont l'heure choisie vient de passer
 * (notification seulement, jamais d'email : c'est quotidien). Une fois par jour,
 * et pas si la journée est déjà remplie. Appelée toutes les 15 minutes par Supabase.
 */
export async function executerRappelsJournal(admin: SupabaseClient, maintenant = new Date()) {
  const bilan = { examinees: 0, rappels: 0, erreurs: 0 };
  if (!configurationRappels().push) return bilan;
  const aujourdhui = aujourdhuiParis();
  const heure = heureParis(maintenant);
  const { data: toutes, error } = await admin
    .from("clientes")
    .select("id, rappel_journal_heure, rappel_journal_envoye")
    .neq("statut", "fermee")
    .eq("journal_actif", true)
    .not("rappel_journal_heure", "is", null);
  if (error || !toutes?.length) return bilan; // rien à faire (ou mise à jour 0014 pas encore faite)
  // Les abonnées n'ont pas (encore) le journal du coaching.
  const abonneesJ = await idsAbonnees(admin);
  const clientes = toutes.filter((c) => !abonneesJ.has(c.id as string));
  if (!clientes.length) return bilan;
  const ids = clientes.map((c) => c.id as string);
  const [{ data: remplies }, { data: appareils }] = await Promise.all([
    admin.from("journal_quotidien").select("cliente_id").eq("jour", aujourdhui).in("cliente_id", ids),
    admin.from("abonnements_push").select("id, cliente_id, endpoint, p256dh, auth").in("cliente_id", ids),
  ]);
  const faites = new Set((remplies ?? []).map((r) => r.cliente_id as string));
  for (const c of clientes) {
    bilan.examinees++;
    const siens = (appareils ?? []).filter((a) => a.cliente_id === c.id) as AbonnementPush[];
    if (!siens.length) continue;
    const du = rappelJournalDu({
      heure: c.rappel_journal_heure as string | null,
      maintenant: heure,
      envoyeLe: c.rappel_journal_envoye as string | null,
      aujourdhui,
      journeeRemplie: faites.has(c.id as string),
    });
    if (!du) continue;
    // Réservation avant l'envoi : jamais deux rappels le même jour.
    const { data: reserve } = await admin
      .from("clientes")
      .update({ rappel_journal_envoye: aujourdhui })
      .eq("id", c.id)
      .or(`rappel_journal_envoye.is.null,rappel_journal_envoye.lt.${aujourdhui}`)
      .select("id")
      .maybeSingle();
    if (!reserve) continue;
    let parti = false;
    for (const a of siens) {
      const r = await envoyerPush(a, { titre: "Ton journal du jour 📒", texte: "1 minute pour noter ta journée : sommeil, eau, pas, ressenti 💛", url: "/suivi/journal" });
      if (r === "ok") parti = true;
      else if (r === "expire") await admin.from("abonnements_push").delete().eq("id", a.id);
      else bilan.erreurs++;
    }
    if (parti) bilan.rappels++;
  }
  return bilan;
}

// ---------------------------------------------------------------- Rappel des compléments (heure choisie par la cliente)

/**
 * Rappel discret des compléments, une fois par jour à l'heure choisie par la cliente (appelé toutes
 * les 15 minutes avec les rappels du journal), seulement s'il lui reste quelque chose à prendre.
 */
export async function executerRappelsComplements(admin: SupabaseClient, maintenant = new Date()) {
  const bilan = { rappels: 0, erreurs: 0 };
  if (!configurationRappels().push) return bilan;
  const aujourdhui = aujourdhuiParis();
  const heure = heureParis(maintenant);
  const { data: clientes, error } = await admin
    .from("clientes")
    .select("id, rappel_complements_heure, rappel_complements_envoye")
    .neq("statut", "fermee")
    .not("rappel_complements_heure", "is", null);
  if (error || !clientes?.length) return bilan; // rien à faire (ou mise à jour 0035 pas encore faite)
  const ids = clientes.map((c) => c.id as string);
  const [{ data: complements }, { data: pris }, { data: appareils }] = await Promise.all([
    admin.from("complements").select("id, cliente_id, nom, ordre").eq("actif", true).in("cliente_id", ids).order("ordre"),
    admin.from("complements_pris").select("complement_id").eq("jour", aujourdhui).in("cliente_id", ids),
    admin.from("abonnements_push").select("id, cliente_id, endpoint, p256dh, auth").in("cliente_id", ids),
  ]);
  const dejaPris = new Set((pris ?? []).map((p) => p.complement_id as string));
  for (const c of clientes) {
    const siens = (appareils ?? []).filter((a) => a.cliente_id === c.id) as AbonnementPush[];
    const reste = (complements ?? []).filter((x) => x.cliente_id === c.id && !dejaPris.has(x.id as string)).map((x) => x.nom as string);
    if (!siens.length) continue;
    const du = rappelComplementsDu({
      heure: c.rappel_complements_heure as string | null,
      maintenant: heure,
      envoyeLe: c.rappel_complements_envoye as string | null,
      aujourdhui,
      resteAPrendre: reste.length,
    });
    if (!du) continue;
    // Réservation avant l'envoi : jamais deux rappels le même jour.
    const { data: reserve } = await admin
      .from("clientes")
      .update({ rappel_complements_envoye: aujourdhui })
      .eq("id", c.id)
      .or(`rappel_complements_envoye.is.null,rappel_complements_envoye.lt.${aujourdhui}`)
      .select("id")
      .maybeSingle();
    if (!reserve) continue;
    let parti = false;
    for (const a of siens) {
      const r = await envoyerPush(a, { titre: "Tes compléments 🌿", texte: texteRappelComplements(reste), url: "/complements" });
      if (r === "ok") parti = true;
      else if (r === "expire") await admin.from("abonnements_push").delete().eq("id", a.id);
      else bilan.erreurs++;
    }
    if (parti) bilan.rappels++;
  }
  return bilan;
}

// ---------------------------------------------------------------- Récap de la semaine (dimanche 18 h)

/**
 * Notification du récap de la semaine, le dimanche à partir de 18 h (appelée toutes les 15 minutes
 * avec les rappels du journal). Une seule fois par semaine et par cliente active, si elle a des
 * notifications activées et n'a pas décoché le récap.
 */
export async function executerRecapsSemaine(admin: SupabaseClient, maintenant = new Date()) {
  const bilan = { recaps: 0, erreurs: 0 };
  const aujourdhui = aujourdhuiParis();
  if (!configurationRappels().push || !recapADonner({ aujourdhui, heure: heureParis(maintenant), dejaEnvoye: null })) return bilan;
  const { data: toutes, error } = await admin
    .from("clientes")
    .select("id, recap_envoye, profils!inner(prenom)")
    .eq("statut", "active")
    .eq("recap_notif", true)
    .or(`recap_envoye.is.null,recap_envoye.lt.${aujourdhui}`);
  if (error || !toutes?.length) return bilan; // rien à faire (ou mise à jour 0033 pas encore faite)
  const abonneesR = await idsAbonnees(admin);
  const clientes = toutes.filter((c) => !abonneesR.has(c.id as string));
  if (!clientes.length) return bilan;
  const ids = clientes.map((c) => c.id as string);
  const { data: appareils } = await admin.from("abonnements_push").select("id, cliente_id, endpoint, p256dh, auth").in("cliente_id", ids);
  const avecAppareil = clientes.filter((c) => (appareils ?? []).some((a) => a.cliente_id === c.id));
  if (!avecAppareil.length) return bilan;
  const prenom = (c: (typeof clientes)[number]) => (c.profils as unknown as { prenom: string }).prenom ?? "";
  const recaps = await chargerRecaps(admin, avecAppareil.map((c) => ({ id: c.id as string, prenom: prenom(c) })), aujourdhui);
  for (const c of avecAppareil) {
    // Réservation avant l'envoi : jamais deux récaps la même semaine.
    const { data: reserve } = await admin
      .from("clientes")
      .update({ recap_envoye: aujourdhui })
      .eq("id", c.id)
      .or(`recap_envoye.is.null,recap_envoye.lt.${aujourdhui}`)
      .select("id")
      .maybeSingle();
    if (!reserve) continue;
    const r = recaps.get(c.id as string);
    if (!r) continue;
    let parti = false;
    for (const a of (appareils ?? []).filter((x) => x.cliente_id === c.id) as AbonnementPush[]) {
      const res = await envoyerPush(a, { titre: "Ton récap de la semaine 🌿", texte: texteNotificationRecap(r), url: "/suivi/recap" });
      if (res === "ok") parti = true;
      else if (res === "expire") await admin.from("abonnements_push").delete().eq("id", a.id);
      else bilan.erreurs++;
    }
    if (parti) bilan.recaps++;
  }
  return bilan;
}

// ---------------------------------------------------------------- Défis du mois (toutes les 15 min)

/**
 * Défis du mois, entre 8 h et 21 h (heure de Paris) : notification de lancement le jour où un défi
 * publié commence (une seule fois), puis réussites repérées par la base (verifier_defis) pour celles
 * qui ne l'ont pas déjà vu dans l'app. Seulement pour les clientes qui n'ont pas décoché les défis.
 * La célébration dans la communauté est faite par la base elle-même.
 */
export async function executerDefis(admin: SupabaseClient, maintenant = new Date()) {
  const bilan = { annonces: 0, reussites: 0, erreurs: 0 };
  const heure = heureParis(maintenant);
  if (heure < HEURES_NOTIF_DEFIS.debut || heure >= HEURES_NOTIF_DEFIS.fin) return bilan;
  const aujourdhui = aujourdhuiParis();
  const push = configurationRappels().push;
  const envoyer = async (clienteId: string, contenu: { titre: string; texte: string; url: string }) => {
    if (!push) return false;
    const { data: appareils } = await admin.from("abonnements_push").select("id, endpoint, p256dh, auth").eq("cliente_id", clienteId);
    let parti = false;
    for (const a of (appareils ?? []) as AbonnementPush[]) {
      const r = await envoyerPush(a, contenu);
      if (r === "ok") parti = true;
      else if (r === "expire") await admin.from("abonnements_push").delete().eq("id", a.id);
      else bilan.erreurs++;
    }
    return parti;
  };

  // 1. Lancement : défis publiés qui commencent (ou ont commencé) et pas encore annoncés.
  const aLancer = (colonnes: string) =>
    admin
      .from("defis")
      .select(colonnes)
      .eq("publie", true)
      .is("annonce_le", null)
      .lte("debut", aujourdhui)
      .gte("fin", aujourdhui)
      .returns<{ id: string; titre: string; audience: string; pour_abonnees?: boolean }[]>();
  let { data: aAnnoncer, error } = await aLancer("id, titre, audience, pour_abonnees");
  if (error) ({ data: aAnnoncer, error } = await aLancer("id, titre, audience")); // avant la mise à jour 0046
  if (error) return bilan; // mise à jour 0042 pas encore faite
  for (const d of aAnnoncer ?? []) {
    // Réservation avant l'envoi : jamais deux annonces du même défi.
    const { data: reserve } = await admin.from("defis").update({ annonce_le: new Date().toISOString() }).eq("id", d.id).is("annonce_le", null).select("id").maybeSingle();
    if (!reserve || !push) continue;
    let ids: string[] = [];
    if (d.audience === "communaute") {
      const { data: ouverte } = await admin.from("reglages").select("communaute_ouverte").maybeSingle();
      if (!ouverte?.communaute_ouverte) continue;
      const { data } = await admin.from("membres_communaute").select("cliente_id, clientes!inner(statut, defis_notif)").eq("statut", "membre").neq("clientes.statut", "fermee").eq("clientes.defis_notif", true);
      ids = (data ?? []).map((m) => m.cliente_id as string);
    } else {
      // Clientes en suivi, et clientes coachées après leur suivi (accès à vie).
      const { data } = await admin.from("clientes").select("id").in("statut", ["active", "terminee"]).eq("defis_notif", true);
      const abonneesD = await idsAbonnees(admin);
      ids = (data ?? []).map((c) => c.id as string).filter((id) => !abonneesD.has(id));
    }
    for (const id of ids) if (await envoyer(id, { titre: "Défi du mois 🎯", texte: texteAnnonceDefi(d), url: "/defis" })) bilan.annonces++;
    // Coché « aussi pour les abonnées » : les abonnées actives qui ont gardé les notifications.
    if (d.pour_abonnees) {
      const { data: abonnees } = await admin.from("clientes").select("id").eq("formule", "abonnement").eq("statut", "active").eq("defis_notif", true);
      const dejaPrevenues = new Set(ids);
      for (const a of abonnees ?? []) {
        if (dejaPrevenues.has(a.id as string)) continue;
        if (await envoyer(a.id as string, { titre: "Défi du mois 🎯", texte: texteAnnonceDefi(d), url: "/espace/bouger" })) bilan.annonces++;
      }
    }
  }

  // 2. Réussites repérées par la base (et pas encore vues dans l'app).
  const { data: reussites } = await admin.rpc("verifier_defis");
  for (const r of (reussites ?? []) as { defi_id: string; cliente_id: string }[]) {
    const { data: reserve } = await admin
      .from("defis_participations")
      .update({ notifie_le: new Date().toISOString() })
      .eq("defi_id", r.defi_id)
      .eq("cliente_id", r.cliente_id)
      .is("notifie_le", null)
      .select("defis(titre), clientes(defis_notif, mode_sans_chiffres, formule)")
      .maybeSingle<{ defis: { titre: string } | null; clientes: { defis_notif: boolean; mode_sans_chiffres: boolean; formule?: string } | null }>();
    if (!reserve?.clientes?.defis_notif) continue;
    const texte = texteReussiteDefi({ titre: reserve.defis?.titre ?? "" }, reserve.clientes.mode_sans_chiffres);
    const url = reserve.clientes.formule === "abonnement" ? "/espace/bouger" : "/defis";
    if (await envoyer(r.cliente_id, { titre: "Défi relevé 🏆", texte, url })) bilan.reussites++;
  }
  return bilan;
}

// ---------------------------------------------------------------- Annonce à toutes les clientes

/** Notification à toutes les clientes qui ont accès à l'app et ont activé les notifications. */
export async function envoyerAnnonce(admin: SupabaseClient, texte: string, url: string) {
  const res = { clientes: 0, notifications: 0 };
  if (!configurationRappels().push) return res;
  const { data: appareils } = await admin
    .from("abonnements_push")
    .select("id, cliente_id, endpoint, p256dh, auth, clientes!inner(statut)")
    .neq("clientes.statut", "fermee");
  const touchees = new Set<string>();
  // Les annonces sont pour les clientes coachées.
  const abonneesA = await idsAbonnees(admin);
  for (const a of ((appareils ?? []) as (AbonnementPush & { cliente_id: string })[]).filter((x) => !abonneesA.has(x.cliente_id))) {
    const r = await envoyerPush(a, { titre: "Un petit mot pour toi 💛", texte, url });
    if (r === "ok") {
      res.notifications++;
      touchees.add(a.cliente_id);
    } else if (r === "expire") await admin.from("abonnements_push").delete().eq("id", a.id);
  }
  res.clientes = touchees.size;
  return res;
}

// ---------------------------------------------------------------- Notification à une cliente

/** Notification sur les appareils d'une cliente (si les notifications sont configurées). */
export async function envoyerPushCliente(
  admin: SupabaseClient,
  clienteId: string,
  contenu: { titre: string; texte: string; url: string },
): Promise<number> {
  if (!configurationRappels().push) return 0;
  const { data: appareils } = await admin.from("abonnements_push").select("id, endpoint, p256dh, auth").eq("cliente_id", clienteId);
  let envoyees = 0;
  for (const a of (appareils ?? []) as AbonnementPush[]) {
    const r = await envoyerPush(a, contenu);
    if (r === "ok") envoyees++;
    else if (r === "expire") await admin.from("abonnements_push").delete().eq("id", a.id);
  }
  return envoyees;
}
