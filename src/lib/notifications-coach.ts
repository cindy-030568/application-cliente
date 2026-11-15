import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/env";
import { configurationRappels, envoyerEmail, envoyerPush, type AbonnementPush } from "@/lib/envoi-rappels";
import { emailRappel } from "@/lib/rappels";
import { createAdminClient } from "@/lib/supabase/admin";

export type PrefsNotifCoach = {
  notif_coach_email: boolean;
  notif_coach_bilans: boolean;
  notif_coach_signalements: boolean;
  notif_coach_messages: boolean;
};
const COLONNES = "notif_coach_email, notif_coach_bilans, notif_coach_signalements, notif_coach_messages";
const PAR_DEFAUT: PrefsNotifCoach = {
  notif_coach_email: true,
  notif_coach_bilans: true,
  notif_coach_signalements: true,
  notif_coach_messages: false,
};

/** Préférences de la coach, ou null si la mise à jour 0012 n'est pas encore faite. */
export async function lirePrefsNotifCoach(supabase: SupabaseClient): Promise<PrefsNotifCoach | null> {
  const { data, error } = await supabase.from("reglages").select(COLONNES).maybeSingle<PrefsNotifCoach>();
  return error || !data ? null : data;
}

export type EvenementCoach =
  | { type: "bilan"; clienteId: string; bilanId: string }
  | { type: "signalement" }
  | { type: "message"; clienteId: string };

/** Contenu de la notification (pur : utilisé aussi pour l'envoi de test). */
export function contenuNotifCoach(e: EvenementCoach, prenom: string) {
  const qui = prenom.trim() || "Une cliente";
  if (e.type === "bilan")
    return { titre: "Nouveau bilan 📝", texte: `${qui} vient d’envoyer son bilan.`, url: `/coach/bilans/${e.bilanId}`, bouton: "Voir le bilan", sujet: `${qui} a envoyé son bilan` };
  if (e.type === "signalement")
    return { titre: "Message signalé ⚠️", texte: "Un message a été signalé dans la communauté.", url: "/coach/communaute", bouton: "Ouvrir la communauté", sujet: "Un message a été signalé" };
  return { titre: "Communauté 💬", texte: `${qui} a écrit dans la communauté.`, url: "/coach/communaute", bouton: "Ouvrir la communauté", sujet: "Nouveau message dans la communauté" };
}

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
 */
export async function notifierCoach(e: EvenementCoach) {
  if (!process.env.SUPABASE_SECRET_KEY) return;
  try {
    const admin = createAdminClient();
    const prefs = (await lirePrefsNotifCoach(admin)) ?? PAR_DEFAUT;
    if (e.type === "bilan" && !prefs.notif_coach_bilans) return;
    if (e.type === "signalement" && !prefs.notif_coach_signalements) return;
    if (e.type === "message") {
      if (!prefs.notif_coach_messages) return;
      const { data } = await admin.from("reglages").select("notif_coach_dernier_message").maybeSingle();
      const dernier = data?.notif_coach_dernier_message as string | null | undefined;
      if (dernier && Date.now() - new Date(dernier).getTime() < 60 * 60 * 1000) return;
      await admin.from("reglages").update({ notif_coach_dernier_message: new Date().toISOString() }).eq("id", true);
    }
    let prenom = "";
    if (e.type !== "signalement") {
      const { data } = await admin.from("profils").select("prenom").eq("id", e.clienteId).maybeSingle();
      prenom = (data?.prenom as string | undefined) ?? "";
    }
    // Un nouveau message de la communauté ne part jamais par email (trop fréquent).
    await envoyerALaCoach(admin, contenuNotifCoach(e, prenom), prefs.notif_coach_email && e.type !== "message");
  } catch (err) {
    console.warn("Notification coach : échec", err instanceof Error ? err.message.slice(0, 120) : "");
  }
}
