import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aujourdhuiParis } from "@/lib/bilan";
import { executerTachesDuMatin } from "@/lib/envoi-rappels";
import { executerProgrammesPlanifies, executerRappelsProgrammes } from "@/lib/rappels-programmes";

/** Qui lance la tâche : l'horloge de Supabase, ou l'hébergeur (tâche planifiée Vercel / Netlify). */
export type SourceTache = "supabase" | "hebergeur";

/**
 * Vérifie l'en-tête « Authorization: Bearer <jeton> » d'un appel planifié :
 * - CRON_SECRET (variable d'environnement) : appel de Vercel ou de Netlify ;
 * - la clé que Supabase garde dans son coffre (vérifiée par une fonction réservée à la clé secrète).
 * Renvoie la source, ou null si l'appel n'est pas autorisé.
 */
export async function sourceAppelPlanifie(autorisation: string | null, admin: SupabaseClient): Promise<SourceTache | null> {
  const jeton = (autorisation ?? "").replace(/^Bearer /, "");
  if (!jeton || jeton.length > 200) return null;
  const secret = process.env.CRON_SECRET;
  if (secret && jeton.length === secret.length && timingSafeEqual(Buffer.from(jeton), Buffer.from(secret))) return "hebergeur";
  const { data } = await admin.rpc("jeton_horloge_valide", { p_jeton: jeton });
  return data === true ? "supabase" : null;
}

/**
 * La tâche du matin : rappels de bilan et de paiement, programmes planifiés, rappels de programme.
 * Un seul passage par jour (mise à jour 0025) : le premier appel la réserve, les suivants ne font rien.
 * Chaque envoi a aussi sa propre protection contre les doublons (rappels_envoyes, dates de rappel).
 * Renvoie des compteurs seulement (aucune donnée personnelle).
 */
export async function lancerTacheDuMatin(admin: SupabaseClient, source: SourceTache, aujourdhui = aujourdhuiParis()) {
  const { data: reservee, error } = await admin.rpc("reserver_tache_du_matin", { p_jour: aujourdhui, p_source: source });
  // Avant la mise à jour 0025 : pas de réservation possible, on lance quand même (les envois restent protégés un par un).
  const verrou = !error;
  if (verrou && reservee !== true) return { dejaFaite: true as const, jour: aujourdhui };
  try {
    const bilans = await executerTachesDuMatin(admin, aujourdhui);
    const planifies = await executerProgrammesPlanifies(admin, aujourdhui).catch(() => ({ misEnLigne: 0, annonces: 0, notifications: 0 }));
    const programmes = await executerRappelsProgrammes(admin, aujourdhui).catch(() => ({ rappels: 0, notifications: 0, emails: 0 }));
    const compteurs = { ...bilans, programmes, planifies };
    if (verrou) await admin.rpc("terminer_tache_du_matin", { p_jour: aujourdhui, p_statut: "ok", p_compteurs: compteurs });
    return { dejaFaite: false as const, jour: aujourdhui, source, ...compteurs };
  } catch (e) {
    if (verrou) await admin.rpc("terminer_tache_du_matin", { p_jour: aujourdhui, p_statut: "echec", p_compteurs: null });
    throw e;
  }
}
