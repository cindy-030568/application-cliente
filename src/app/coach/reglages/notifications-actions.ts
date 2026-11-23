"use server";

import { revalidatePath } from "next/cache";
import { contenuNotifCoach, envoyerALaCoach } from "@/lib/notifications-coach";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_PERDUE, sessionCoach } from "../clientes/verification";

export type EtatNotifCoach = { erreur?: string; succes?: string };
const CLES = [
  "notif_coach_email",
  "notif_coach_bilans",
  "notif_coach_signalements",
  "notif_coach_messages",
  "notif_coach_journal",
  "notif_coach_seances",
  "notif_coach_alertes",
  "notif_coach_programmes",
  "notif_coach_inscriptions",
] as const;

export async function changerNotifCoach(cle: string, valeur: boolean): Promise<EtatNotifCoach> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!(CLES as readonly string[]).includes(cle)) return { erreur: "Réglage inconnu." };
  const { error } = await session.supabase.from("reglages").update({ [cle]: valeur === true }).eq("id", true);
  if (error) return { erreur: "Ça n’a pas fonctionné. As-tu fait les mises à jour 0012 et 0024 dans Supabase ?" };
  revalidatePath("/coach/reglages");
  return {};
}

type Abonnement = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

export async function enregistrerAppareilCoach(abonnement: Abonnement, appareil: string): Promise<EtatNotifCoach> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const endpoint = typeof abonnement?.endpoint === "string" ? abonnement.endpoint : "";
  const p256dh = typeof abonnement?.keys?.p256dh === "string" ? abonnement.keys.p256dh : "";
  const auth = typeof abonnement?.keys?.auth === "string" ? abonnement.keys.auth : "";
  if (!endpoint.startsWith("https://") || endpoint.length > 1000 || !p256dh || p256dh.length > 200 || !auth || auth.length > 100) {
    return { erreur: "Cet appareil n’a pas pu être enregistré." };
  }
  await session.supabase.from("abonnements_coach").delete().eq("endpoint", endpoint);
  const { error } = await session.supabase
    .from("abonnements_coach")
    .insert({ endpoint, p256dh, auth, appareil: String(appareil ?? "").slice(0, 60) });
  if (error) return { erreur: "Cet appareil n’a pas pu être enregistré. As-tu fait la mise à jour 0012 dans Supabase ?" };
  revalidatePath("/coach/reglages");
  return { succes: "Notifications activées sur cet appareil." };
}

export async function retirerAppareilCoach(endpoint: string): Promise<EtatNotifCoach> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (typeof endpoint === "string" && endpoint) await session.supabase.from("abonnements_coach").delete().eq("endpoint", endpoint);
  revalidatePath("/coach/reglages");
  return { succes: "Notifications désactivées sur cet appareil." };
}

/** Envoie une notification de test (appareils + email si activé). */
export async function testerNotifCoach(email: boolean): Promise<EtatNotifCoach> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  try {
    const contenu = {
      ...contenuNotifCoach({ type: "bilan", clienteId: "", bilanId: "" }, "Test"),
      texte: "C’est tout bon : tu seras prévenue ici quand une cliente enverra son bilan 💛",
      url: "/coach",
      sujet: "Test des notifications fitw_cindy",
      bouton: "Ouvrir mon tableau de bord",
    };
    const r = await envoyerALaCoach(createAdminClient(), contenu, email);
    if (!r.notifications && !r.emails) return { erreur: "Rien n’est parti : active d’abord les notifications sur cet appareil (ou l’email)." };
    return {
      succes: [r.notifications && `${r.notifications} notification${r.notifications > 1 ? "s" : ""}`, r.emails && "1 email"]
        .filter(Boolean)
        .join(" et ") + " envoyé(s). Ça arrive dans quelques secondes.",
    };
  } catch {
    return { erreur: "Le test n’a pas pu partir. Réessaie dans un moment." };
  }
}
