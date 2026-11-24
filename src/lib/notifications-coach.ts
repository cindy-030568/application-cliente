import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/env";
import { configurationRappels, envoyerEmail, envoyerPush, type AbonnementPush } from "@/lib/envoi-rappels";
import { emailRappel } from "@/lib/rappels";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIBELLE_MOTIF, type MotifAlerte } from "@/lib/alertes-notes";

export type PrefsNotifCoach = {
  notif_coach_email: boolean;
  notif_coach_bilans: boolean;
  notif_coach_alertes: boolean;
  notif_coach_journal: boolean;
  notif_coach_seances: boolean;
  notif_coach_programmes: boolean;
  notif_coach_signalements: boolean;
  notif_coach_messages: boolean;
  notif_coach_inscriptions: boolean;
};
const COLONNES = "notif_coach_email, notif_coach_bilans, notif_coach_signalements, notif_coach_messages";
/** Ajoutées par la mise à jour 0024 : lues à part, cochées tant qu'elle n'est pas faite. */
const COLONNES_0024 = "notif_coach_journal, notif_coach_seances, notif_coach_alertes, notif_coach_programmes";
export const PAR_DEFAUT: PrefsNotifCoach = {
  notif_coach_email: true,
  notif_coach_bilans: true,
  notif_coach_alertes: true,
  notif_coach_journal: true,
  notif_coach_seances: true,
  notif_coach_programmes: true,
  notif_coach_signalements: true,
  notif_coach_messages: true,
  notif_coach_inscriptions: true,
};

/** Préférences de la coach, ou null si la mise à jour 0012 n'est pas encore faite. */
export async function lirePrefsNotifCoach(supabase: SupabaseClient): Promise<(PrefsNotifCoach & { sans0024: boolean; sans0026: boolean }) | null> {
  const { data, error } = await supabase.from("reglages").select(COLONNES).maybeSingle();
  if (error || !data) return null;
  const [{ data: plus, error: sans0024 }, { data: inscr, error: sans0026 }] = await Promise.all([
    supabase.from("reglages").select(COLONNES_0024).maybeSingle(),
    supabase.from("reglages").select("notif_coach_inscriptions").maybeSingle(),
  ]);
  return {
    ...PAR_DEFAUT,
    ...data,
    ...(sans0024 || !plus ? {} : plus),
    ...(sans0026 || !inscr ? {} : inscr),
    sans0024: Boolean(sans0024),
    sans0026: Boolean(sans0026),
  };
}

export type EvenementCoach =
  | { type: "bilan"; clienteId: string; bilanId: string }
  | { type: "signalement" }
  | { type: "message"; clienteId: string }
  | { type: "journal"; clienteId: string }
  | { type: "seance"; clienteId: string; nom: string }
  | { type: "alerte"; clienteId: string; motif: MotifAlerte; source: "journal" | "seance" }
  | { type: "inscription"; prenom: string }
  | { type: "questionnaire"; clienteId: string; prenom: string }
  | { type: "suite"; clienteId: string; offre: string };

/** Contenu de la notification (pur : utilisé aussi pour l'envoi de test). Jamais le texte de la cliente (données de santé). */
export function contenuNotifCoach(e: EvenementCoach, prenom: string) {
  const qui = prenom.trim() || "Une cliente";
  if (e.type === "bilan")
    return { titre: "Nouveau bilan 📝", texte: `${qui} vient d’envoyer son bilan.`, url: `/coach/bilans/${e.bilanId}`, bouton: "Voir le bilan", sujet: `${qui} a envoyé son bilan` };
  if (e.type === "signalement")
    return { titre: "Message signalé ⚠️", texte: "Un message a été signalé dans la communauté.", url: "/coach/communaute", bouton: "Ouvrir la communauté", sujet: "Un message a été signalé" };
  if (e.type === "inscription")
    return {
      titre: "Nouvelle demande d’inscription ✨",
      texte: `${e.prenom.trim() || "Quelqu’un"} a rempli ton formulaire d’inscription : sa fiche t’attend, à vérifier avant de l’inviter.`,
      url: "/coach/clientes#a-valider",
      bouton: "Voir la demande",
      sujet: "Nouvelle demande d’inscription",
    };
  if (e.type === "questionnaire")
    return {
      titre: "Questionnaire d’arrivée reçu 📋",
      texte: `${qui} a rempli son questionnaire d’arrivée : ses exclusions et son objectif sont pré-remplis dans sa fiche.`,
      url: `/coach/clientes/${e.clienteId}`,
      bouton: "Voir ses réponses",
      sujet: `${qui} a rempli son questionnaire d’arrivée`,
    };
  if (e.type === "suite")
    return {
      titre: "Envie de continuer avec toi ✨",
      texte: `${qui} a cliqué sur « ${e.offre} » dans son bilan de fin de suivi.`,
      url: `/coach/clientes/${e.clienteId}`,
      bouton: "Voir sa fiche",
      sujet: `${qui} veut continuer avec toi`,
    };
  if (e.type === "journal")
    return { titre: "Journée remplie ✍️", texte: `${qui} a rempli sa journée.`, url: `/coach/clientes/${e.clienteId}/suivi`, bouton: "Voir son journal", sujet: `${qui} a rempli sa journée` };
  if (e.type === "seance")
    return {
      titre: "Séance faite 💪",
      texte: `${qui} a terminé sa séance « ${e.nom} ».`,
      url: `/coach/clientes/${e.clienteId}/programme-sportif`,
      bouton: "Voir ses séances",
      sujet: `${qui} a fait sa séance`,
    };
  if (e.type === "alerte") {
    const ou = e.source === "journal" ? "dans les notes de sa journée" : "en commentaire de sa séance";
    return {
      titre: "À lire vite ⚠️",
      texte: `${qui} a écrit ${ou} quelque chose qui concerne ${LIBELLE_MOTIF[e.motif]}.`,
      url: e.source === "journal" ? `/coach/clientes/${e.clienteId}/suivi` : `/coach/clientes/${e.clienteId}/programme-sportif`,
      bouton: e.source === "journal" ? "Lire son journal" : "Lire son commentaire",
      sujet: `À lire vite : un message de ${qui}`,
    };
  }
  return { titre: "Communauté 💬", texte: `${qui} a écrit dans la communauté.`, url: "/coach/communaute", bouton: "Ouvrir la communauté", sujet: "Nouveau message dans la communauté" };
}

/** Case à cocher qui commande chaque événement. */
const CASE: Record<EvenementCoach["type"], keyof PrefsNotifCoach> = {
  bilan: "notif_coach_bilans",
  signalement: "notif_coach_signalements",
  message: "notif_coach_messages",
  journal: "notif_coach_journal",
  seance: "notif_coach_seances",
  alerte: "notif_coach_alertes",
  inscription: "notif_coach_inscriptions",
  questionnaire: "notif_coach_bilans",
  suite: "notif_coach_inscriptions",
};
/** Trop fréquents pour un email : notification seulement. */
const SANS_EMAIL: EvenementCoach["type"][] = ["message", "journal", "seance"];

/** Envoie la notification aux appareils de la coach et/ou par email. Renvoie ce qui est parti. */
export async function envoyerALaCoach(
  admin: SupabaseClient,
  contenu: ReturnType<typeof contenuNotifCoach>,
  email: boolean,
): Promise<{ notifications: number; emails: number }> {
  const res = { notifications: 0, emails: 0 };
  const config = configurationRappels();
  if (config.push) {
    const { data: appareils } = await admin.from("abonnements_coach").select("id, endpoint, p256dh, auth").returns<AbonnementPush[]>();
    for (const a of appareils ?? []) {
      const r = await envoyerPush(a, { titre: contenu.titre, texte: contenu.texte, url: contenu.url });
      if (r === "ok") res.notifications++;
      else if (r === "expire") await admin.from("abonnements_coach").delete().eq("id", a.id);
    }
  }
  if (email && config.email) {
    const { data: coachs } = await admin.from("profils").select("prenom, email").eq("role", "coach");
    for (const c of coachs ?? []) {
      if (!c.email) continue;
      const { html, texte } = emailRappel(
        contenu.texte,
        `${SITE_URL()}${contenu.url}`,
        `${SITE_URL()}/coach/reglages`,
        contenu.bouton,
        "Notification de ton app fitw_cindy. Pour la régler :",
      );
      try {
        await envoyerEmail({ email: c.email, nom: c.prenom ?? "", sujet: contenu.sujet, html, texte });
        res.emails++;
      } catch (e) {
        console.warn("Notification coach : email non envoyé", e instanceof Error ? e.message.slice(0, 120) : "");
      }
    }
  }
  return res;
}

/**
 * Prévient la coach d'un événement (appelée après la réponse, sans bloquer la cliente).
 * Utilise la clé secrète : une cliente ne peut lire ni l'email ni les appareils de la coach.
 * Nouveaux messages de la communauté : au plus une notification par heure.
 * Chaque événement suit sa case dans Réglages → Notifications.
 */
export async function notifierCoach(e: EvenementCoach) {
  if (!process.env.SUPABASE_SECRET_KEY) return;
  try {
    const admin = createAdminClient();
    const prefs = (await lirePrefsNotifCoach(admin)) ?? PAR_DEFAUT;
    if (!prefs[CASE[e.type]]) return;
    if (e.type === "message") {
      const { data } = await admin.from("reglages").select("notif_coach_dernier_message").maybeSingle();
      const dernier = data?.notif_coach_dernier_message as string | null | undefined;
      if (dernier && Date.now() - new Date(dernier).getTime() < 60 * 60 * 1000) return;
      await admin.from("reglages").update({ notif_coach_dernier_message: new Date().toISOString() }).eq("id", true);
    }
    let prenom = "";
    if (e.type !== "signalement" && e.type !== "inscription") {
      const { data } = await admin.from("profils").select("prenom").eq("id", e.clienteId).maybeSingle();
      prenom = (data?.prenom as string | undefined) ?? "";
    }
    // Messages de la communauté, journées, séances : jamais par email (trop fréquents).
    await envoyerALaCoach(admin, contenuNotifCoach(e, prenom), prefs.notif_coach_email && !SANS_EMAIL.includes(e.type));
  } catch (err) {
    console.warn("Notification coach : échec", err instanceof Error ? err.message.slice(0, 120) : "");
  }
}
