import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ajouterJours, aujourdhuiParis, formaterDate, joursEntre } from "@/lib/bilan";
import { configurationRappels, envoyerPushCliente } from "@/lib/envoi-rappels";
import { activerProgrammesPlanifies, clientesAvecSuitePlanifiee } from "@/lib/programme-sportif-serveur";
import { envoyerALaCoach, lirePrefsNotifCoach } from "@/lib/notifications-coach";
import { ANNONCE_JOURS, dateRenouvellement, echeanceRenouvellement, rappelRenouvellementDu, type TypeRappelProgramme } from "@/lib/programme-sportif";

type Rappel = { programmeId: string; clienteId: string; prenom: string; date: string; type: TypeRappelProgramme };

/** Contenu de la notification à la coach (pur : testé). Un seul message, même pour plusieurs clientes. */
export function contenuRappelProgrammes(rappels: Omit<Rappel, "programmeId">[], aujourdhui: string) {
  if (rappels.length === 1) {
    const r = rappels[0];
    const qui = r.prenom.trim() || "une cliente";
    const e = echeanceRenouvellement(r.date, aujourdhui);
    const quand = formaterDate(r.date, { weekday: "long", year: undefined });
    const texte =
      e.jours < 0
        ? `Relance : le programme sportif de ${qui} est terminé depuis ${-e.jours} jour${e.jours < -1 ? "s" : ""} et le suivant n’est pas encore dans l’appli.`
        : e.jours === 0
          ? `Le programme sportif de ${qui} arrive au bout de ses 6 semaines et le suivant n’est pas encore dans l’appli : c’est le moment de le publier.`
          : r.type === "relance"
            ? `Le programme sportif de ${qui} se termine le ${quand} (${e.texte}) et le suivant n’est pas encore dans l’appli.`
            : `Le programme sportif de ${qui} est à changer le ${quand} (${e.texte}).`;
    return {
      titre: e.jours < 0 ? "Relance : programme sportif à changer ⏰" : "Programme sportif à changer 🏋️",
      texte,
      url: `/coach/clientes/${r.clienteId}/programme-sportif`,
      bouton: "Préparer son programme",
      sujet: `${e.jours < 0 ? "Relance : p" : "P"}rogramme sportif de ${qui} à changer`,
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
 * Tâche du matin : prévient la coach quand le programme d'une cliente arrive au bout et que
 * le suivant n'est ni en ligne ni planifié (J-7, J-3, jour J, puis tous les 3 jours pendant
 * 2 semaines). Rien avant la mise à jour 0018.
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

  // Changement déjà planifié : il se fera tout seul, inutile de prévenir la coach.
  const avecSuite = await clientesAvecSuitePlanifiee(admin);
  const ids = [...new Set(programmes.map((p) => p.cliente_id as string))].filter((id) => !avecSuite.has(id));
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

/** Texte de la notification à la cliente quelques jours avant son nouveau programme (pur : testé). */
export function texteAnnonceProgramme(debutLe: string, aujourdhui: string): string {
  const j = joursEntre(aujourdhui, debutLe);
  const quand = j <= 1 ? "demain" : `${formaterDate(debutLe, { weekday: "long", year: undefined })} (dans ${j} jours)`;
  return `Ton nouveau programme sportif arrive ${quand}. Termine bien celui-ci, tu y es presque !`;
}

/**
 * Tâche du matin, côté cliente : met en ligne les programmes planifiés arrivés à date
 * (et la prévient), puis annonce ceux qui arrivent dans 3 jours ou moins. Rien avant la mise à jour 0020.
 */
export async function executerProgrammesPlanifies(admin: SupabaseClient, aujourdhui = aujourdhuiParis()) {
  const bilan = { misEnLigne: 0, annonces: 0, notifications: 0 };
  const enLigne = await activerProgrammesPlanifies(admin);
  bilan.misEnLigne = enLigne.length;
  if (enLigne.length) {
    const { data } = await admin.from("programmes_sportifs").select("cliente_id").in("id", enLigne);
    for (const p of data ?? []) {
      bilan.notifications += await envoyerPushCliente(admin, p.cliente_id as string, {
        titre: "Ton nouveau programme sportif est là 💪",
        texte: "Il t’attend dans ton onglet Sport. Bonne séance !",
        url: "/sport",
      });
    }
  }

  const { data: aVenir, error } = await admin
    .from("programmes_sportifs")
    .select("id, cliente_id, debut_le, clientes!inner(statut)")
    .eq("publie", false)
    .is("publie_le", null)
    .is("annonce_le", null)
    .gt("debut_le", aujourdhui)
    .lte("debut_le", ajouterJours(aujourdhui, ANNONCE_JOURS))
    .neq("clientes.statut", "fermee");
  if (error) return bilan;
  for (const p of aVenir ?? []) {
    // Réservation avant l'envoi : une seule annonce par programme.
    const { data: reserve } = await admin
      .from("programmes_sportifs")
      .update({ annonce_le: aujourdhui })
      .eq("id", p.id)
      .is("annonce_le", null)
      .select("id")
      .maybeSingle();
    if (!reserve) continue;
    bilan.annonces++;
    bilan.notifications += await envoyerPushCliente(admin, p.cliente_id as string, {
      titre: "Nouveau programme bientôt 🗓️",
      texte: texteAnnonceProgramme(p.debut_le as string, aujourdhui),
      url: "/sport",
    });
  }
  return bilan;
}
