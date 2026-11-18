import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aujourdhuiParis, formaterDate } from "@/lib/bilan";
import { configurationRappels } from "@/lib/envoi-rappels";
import { envoyerALaCoach, lirePrefsNotifCoach } from "@/lib/notifications-coach";
import { dateRenouvellement, echeanceRenouvellement, rappelRenouvellementDu } from "@/lib/programme-sportif";

type Rappel = { programmeId: string; clienteId: string; prenom: string; date: string; type: "bientot" | "jour" };

/** Contenu de la notification à la coach (pur : testé). Un seul message, même pour plusieurs clientes. */
export function contenuRappelProgrammes(rappels: Omit<Rappel, "programmeId">[], aujourdhui: string) {
  if (rappels.length === 1) {
    const r = rappels[0];
    const qui = r.prenom.trim() || "une cliente";
    const e = echeanceRenouvellement(r.date, aujourdhui);
    const texte =
      e.jours <= 0
        ? `Le programme sportif de ${qui} arrive au bout de ses 6 semaines : c’est le moment de publier le suivant.`
        : `Le programme sportif de ${qui} est à changer le ${formaterDate(r.date, { weekday: "long", year: undefined })} (${e.texte}).`;
    return {
      titre: "Programme sportif à changer 🏋️",
      texte,
      url: `/coach/clientes/${r.clienteId}/programme-sportif`,
      bouton: "Préparer son programme",
      sujet: `Programme sportif de ${qui} à changer`,
    };
  }
  const liste = rappels.map((r) => `${r.prenom.trim() || "une cliente"} (${echeanceRenouvellement(r.date, aujourdhui).texte})`).join(", ");
  return {
    titre: "Programmes sportifs à changer 🏋️",
    texte: `${rappels.length} programmes sportifs à changer : ${liste}.`,
    url: "/coach",
    bouton: "Voir mon tableau de bord",
    sujet: `${rappels.length} programmes sportifs à changer`,
  };
}

/**
 * Tâche du matin : prévient la coach une semaine avant le changement de programme
 * d'une cliente, puis le jour même. Rien avant la mise à jour 0018.
 */
export async function executerRappelsProgrammes(admin: SupabaseClient, aujourdhui = aujourdhuiParis()) {
  const bilan = { rappels: 0, notifications: 0, emails: 0 };
  const config = configurationRappels();
  if (!config.push && !config.email) return bilan;
  const { data: programmes, error } = await admin
    .from("programmes_sportifs")
    .select("id, cliente_id, publie_le, renouveler_le, rappel_renouvellement_le")
    .eq("publie", true);
  if (error || !programmes?.length) return bilan;

  const ids = [...new Set(programmes.map((p) => p.cliente_id as string))];
  const { data: clientes } = await admin.from("clientes").select("id, statut, profils!inner(prenom)").in("id", ids);
  const prenomDe = new Map<string, string>();
  for (const c of clientes ?? []) {
    if (c.statut === "fermee") continue;
    const p = (Array.isArray(c.profils) ? c.profils[0] : c.profils) as { prenom: string | null } | undefined;
    prenomDe.set(c.id as string, p?.prenom ?? "");
  }

  const rappels: Rappel[] = [];
  for (const p of programmes) {
    if (!prenomDe.has(p.cliente_id as string)) continue;
    const date = dateRenouvellement({ renouveler_le: p.renouveler_le as string | null, publie_le: p.publie_le as string | null });
    if (!date) continue;
    const type = rappelRenouvellementDu(date, aujourdhui, p.rappel_renouvellement_le as string | null);
    if (!type) continue;
    // Réservation avant l'envoi : jamais deux rappels le même jour pour un programme.
    const { data: reserve } = await admin
      .from("programmes_sportifs")
      .update({ rappel_renouvellement_le: aujourdhui })
      .eq("id", p.id)
      .or(`rappel_renouvellement_le.is.null,rappel_renouvellement_le.lt.${aujourdhui}`)
      .select("id")
      .maybeSingle();
    if (!reserve) continue;
    rappels.push({ programmeId: p.id as string, clienteId: p.cliente_id as string, prenom: prenomDe.get(p.cliente_id as string) ?? "", date, type });
  }
  if (!rappels.length) return bilan;

  rappels.sort((a, b) => a.date.localeCompare(b.date));
  const prefs = await lirePrefsNotifCoach(admin);
  const envoi = await envoyerALaCoach(admin, contenuRappelProgrammes(rappels, aujourdhui), prefs?.notif_coach_email ?? true);
  return { rappels: rappels.length, notifications: envoi.notifications, emails: envoi.emails };
}
