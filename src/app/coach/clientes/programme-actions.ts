"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { envoyerPushCliente } from "@/lib/envoi-rappels";
import { ajouterJours, aujourdhuiParis } from "@/lib/bilan";
import { datesPlanning, extraireProgramme, extraireProgrammes, renouvellementParDefaut } from "@/lib/programme-sportif";
import { activerProgrammesPlanifies } from "@/lib/programme-sportif-serveur";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID, verifierCliente } from "./verification";

export type EtatProgramme = { erreur?: string; succes?: string };

const MIGRATION_PLANNING = "Fais d’abord la mise à jour de la base : fichier 0020_programmes_planifies.sql (voir le guide).";
const MIGRATION_DATE = "Fais d’abord la mise à jour de la base : fichier 0018_renouvellement_programme.sql (voir le guide).";
const MIGRATION = "Fais d’abord la mise à jour de la base : fichier 0016_programme_sportif.sql (voir le guide).";

function rafraichir(clienteId: string, programmeId?: string) {
  revalidatePath(`/coach/clientes/${clienteId}`);
  revalidatePath(`/coach/clientes/${clienteId}/programme-sportif`);
  if (programmeId) revalidatePath(`/coach/clientes/${clienteId}/programme-sportif/${programmeId}`);
  revalidatePath("/sport");
  revalidatePath("/coach");
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Colle la réponse de Claude : crée un nouveau programme (brouillon), ou remplace le contenu d'un programme existant. */
export async function importerProgramme(clienteId: string, programmeId: string | null, _e: EtatProgramme, formData: FormData): Promise<EtatProgramme> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };
  const colle = String(formData.get("reponse") ?? "").slice(0, 600000);
  if (!programmeId) {
    // Plusieurs programmes dans la même réponse (ex. tous les PDF de la cliente) : un brouillon par programme.
    const m = extraireProgrammes(colle);
    if (m.programmes && m.programmes.length > 1) {
      const t0 = Date.now();
      const lignes = m.programmes.map((p, i) => ({
        cliente_id: clienteId,
        titre: (p.titre || `Programme ${i + 1}`).slice(0, 100),
        contenu: p,
        // Dans l'ordre de la réponse de Claude (sert à l'ordre du planning).
        created_at: new Date(t0 + i * 1000).toISOString(),
        updated_at: new Date(t0 + i * 1000).toISOString(),
      }));
      const { error } = await v.supabase.from("programmes_sportifs").insert(lignes);
      if (error) return { erreur: ["42P01", "PGRST205"].includes(error.code) ? MIGRATION : "Les programmes n’ont pas pu être enregistrés. Réessaie." };
      rafraichir(clienteId);
      return { succes: `${lignes.length} programmes importés en brouillon. Planifie-les ci-dessous (« Planning des programmes »).` };
    }
    if (m.erreur && /^Programme n°/.test(m.erreur)) return { erreur: m.erreur };
  }
  const r = extraireProgramme(colle);
  if (!r.programme) return { erreur: r.erreur };
  const titre = (String(formData.get("titre") ?? "").trim() || r.programme.titre || "Programme sportif").slice(0, 100);

  if (programmeId) {
    if (!UUID.test(programmeId)) return { erreur: "Programme introuvable." };
    const { data, error } = await v.supabase
      .from("programmes_sportifs")
      .update({ contenu: r.programme, titre, updated_at: new Date().toISOString() })
      .eq("id", programmeId)
      .eq("cliente_id", clienteId)
      .select("id");
    if (error || !data?.length) return { erreur: "Le programme n’a pas pu être remplacé. Réessaie." };
    rafraichir(clienteId, programmeId);
    return { succes: "Programme remplacé par la nouvelle version." };
  }

  const { data, error } = await v.supabase
    .from("programmes_sportifs")
    .insert({ cliente_id: clienteId, titre, contenu: r.programme })
    .select("id")
    .single();
  if (error || !data) return { erreur: ["42P01", "PGRST205"].includes(error?.code ?? "") ? MIGRATION : "Le programme n’a pas pu être enregistré. Réessaie." };
  rafraichir(clienteId);
  redirect(`/coach/clientes/${clienteId}/programme-sportif/${data.id}`);
}

export async function renommerProgramme(clienteId: string, programmeId: string, titre: string): Promise<EtatProgramme> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };
  const t = titre.trim().slice(0, 100);
  if (!UUID.test(programmeId) || !t) return { erreur: "Titre manquant." };
  const { error } = await v.supabase.from("programmes_sportifs").update({ titre: t, updated_at: new Date().toISOString() }).eq("id", programmeId).eq("cliente_id", clienteId);
  if (error) return { erreur: "Le titre n’a pas pu être enregistré." };
  rafraichir(clienteId, programmeId);
  return { succes: "Titre enregistré." };
}

export async function publierProgramme(clienteId: string, programmeId: string, publie: boolean): Promise<EtatProgramme> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };
  if (!UUID.test(programmeId)) return { erreur: "Programme introuvable." };
  // Un programme qu'on republie (après une correction) garde sa date de changement.
  const { data: avant } = await v.supabase.from("programmes_sportifs").select("publie").eq("id", programmeId).maybeSingle<{ publie: boolean }>();
  const { error } = await v.supabase.rpc("publier_programme_sportif", { p_programme: programmeId, p_publie: publie });
  if (error) return { erreur: "Le programme n’a pas pu être publié. Réessaie dans un instant." };
  if (publie && !avant?.publie) {
    // Nouveau programme : changement prévu dans 6 semaines (ignoré tant que la mise à jour 0018 n'est pas faite).
    await v.supabase
      .from("programmes_sportifs")
      .update({ renouveler_le: renouvellementParDefaut(aujourdhuiParis()), rappel_renouvellement_le: null })
      .eq("id", programmeId);
  }
  rafraichir(clienteId, programmeId);
  if (publie) {
    after(async () => {
      try {
        await envoyerPushCliente(createAdminClient(), clienteId, {
          titre: "Ton programme sportif est prêt 💪",
          texte: "Cindy vient de publier ton programme. Ouvre l’onglet Sport pour le découvrir.",
          url: "/sport",
        });
      } catch {
        // La publication reste valable même si la notification échoue.
      }
    });
  }
  if (publie) await synchroniserSuite(v.supabase, clienteId);
  return { succes: publie ? `Programme publié : ${v.prenom} le voit dans son onglet Sport.` : "Programme retiré : elle ne le voit plus." };
}

export async function supprimerProgramme(clienteId: string, programmeId: string): Promise<EtatProgramme> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };
  if (!UUID.test(programmeId)) return { erreur: "Programme introuvable." };
  const { error } = await v.supabase.from("programmes_sportifs").delete().eq("id", programmeId).eq("cliente_id", clienteId);
  if (error) return { erreur: "Le programme n’a pas pu être supprimé." };
  rafraichir(clienteId);
  redirect(`/coach/clientes/${clienteId}/programme-sportif`);
}

/** La coach choisit une autre date de changement (report, vacances, blessure…). */
export async function modifierRenouvellement(clienteId: string, programmeId: string, date: string): Promise<EtatProgramme> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };
  if (!UUID.test(programmeId)) return { erreur: "Programme introuvable." };
  const auj = aujourdhuiParis();
  if (!DATE.test(date) || date < ajouterJours(auj, -365) || date > ajouterJours(auj, 365)) return { erreur: "Choisis une date valide (au plus tard dans un an)." };
  const { data, error } = await v.supabase
    .from("programmes_sportifs")
    .update({ renouveler_le: date })
    .eq("id", programmeId)
    .eq("cliente_id", clienteId)
    .select("id");
  if (error) return { erreur: ["42703", "PGRST204"].includes(error.code) ? MIGRATION_DATE : "La date n’a pas pu être enregistrée. Réessaie." };
  if (!data?.length) return { erreur: "Programme introuvable." };
  rafraichir(clienteId, programmeId);
  return { succes: "Date du prochain programme enregistrée." };
}

type Client = Exclude<Awaited<ReturnType<typeof verifierCliente>>, { erreur: string }>["supabase"];

/** Le programme en ligne se termine quand le prochain programme planifié démarre. */
async function synchroniserSuite(supabase: Client, clienteId: string) {
  const { data, error } = await supabase
    .from("programmes_sportifs")
    .select("debut_le")
    .eq("cliente_id", clienteId)
    .eq("publie", false)
    .is("publie_le", null)
    .gt("debut_le", aujourdhuiParis())
    .order("debut_le")
    .limit(1);
  const suivant = error ? null : ((data?.[0]?.debut_le as string | undefined) ?? null);
  if (!suivant) return;
  await supabase
    .from("programmes_sportifs")
    .update({ renouveler_le: suivant, rappel_renouvellement_le: null })
    .eq("cliente_id", clienteId)
    .eq("publie", true)
    .or(`renouveler_le.is.null,renouveler_le.neq.${suivant}`);
}

/** Après un changement de planning : ce qui est arrivé à date passe en ligne (et la cliente est prévenue). */
async function appliquerPlanning(supabase: Client, clienteId: string) {
  const enLigne = await activerProgrammesPlanifies(supabase, clienteId);
  await synchroniserSuite(supabase, clienteId);
  if (enLigne.length) {
    after(async () => {
      try {
        await envoyerPushCliente(createAdminClient(), clienteId, {
          titre: "Ton nouveau programme sportif est là 💪",
          texte: "Il t’attend dans ton onglet Sport. Bonne séance !",
          url: "/sport",
        });
      } catch {
        // la mise en ligne reste valable même si la notification échoue
      }
    });
  }
  return enLigne.length;
}

/**
 * Planifie tous les programmes pas encore publiés, dans l'ordre d'import :
 * un toutes les 6 semaines à partir de la date de début du coaching.
 */
export async function planifierProgrammes(clienteId: string): Promise<EtatProgramme> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };
  const [{ data: fiche }, { data: progs, error }] = await Promise.all([
    v.supabase.from("clientes").select("date_debut").eq("id", clienteId).maybeSingle<{ date_debut: string | null }>(),
    v.supabase.from("programmes_sportifs").select("id, publie, publie_le, debut_le, created_at").eq("cliente_id", clienteId).order("created_at"),
  ]);
  if (error) return { erreur: ["42703", "PGRST204"].includes(error.code) ? MIGRATION_PLANNING : "Le planning n’a pas pu être lu. Réessaie." };
  const aPlanifier = (progs ?? []).filter((p) => !p.publie && !p.publie_le);
  if (!aPlanifier.length) return { erreur: "Aucun programme à planifier : importe d’abord les programmes de ta cliente." };
  const enLigne = (progs ?? []).some((p) => p.publie);
  const dates = datesPlanning(fiche?.date_debut ?? null, aujourdhuiParis(), enLigne, aPlanifier.length);
  for (const [i, p] of aPlanifier.entries()) {
    const { error: e } = await v.supabase.from("programmes_sportifs").update({ debut_le: dates[i], annonce_le: null }).eq("id", p.id);
    if (e) return { erreur: ["42703", "PGRST204"].includes(e.code) ? MIGRATION_PLANNING : "Le planning n’a pas pu être enregistré. Réessaie." };
  }
  const nb = await appliquerPlanning(v.supabase, clienteId);
  rafraichir(clienteId);
  return {
    succes:
      `${aPlanifier.length} programme${aPlanifier.length > 1 ? "s planifiés" : " planifié"} toutes les 6 semaines` +
      (fiche?.date_debut ? "" : " à partir d’aujourd’hui (aucune date de début de coaching dans sa fiche)") +
      (nb ? `. Le premier est déjà en ligne : ${v.prenom} est prévenue.` : "."),
  };
}

/** Date de mise en ligne d'un programme (null = le retirer du planning). */
export async function modifierDebutProgramme(clienteId: string, programmeId: string, date: string | null): Promise<EtatProgramme> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };
  if (!UUID.test(programmeId)) return { erreur: "Programme introuvable." };
  const auj = aujourdhuiParis();
  if (date !== null && (!DATE.test(date) || date < ajouterJours(auj, -365) || date > ajouterJours(auj, 3 * 365))) return { erreur: "Choisis une date valide." };
  const { data, error } = await v.supabase
    .from("programmes_sportifs")
    .update({ debut_le: date, annonce_le: null })
    .eq("id", programmeId)
    .eq("cliente_id", clienteId)
    .eq("publie", false)
    .is("publie_le", null)
    .select("id");
  if (error) return { erreur: ["42703", "PGRST204"].includes(error.code) ? MIGRATION_PLANNING : "La date n’a pas pu être enregistrée. Réessaie." };
  if (!data?.length) return { erreur: "Ce programme a déjà été publié : il ne peut plus être planifié." };
  const nb = date ? await appliquerPlanning(v.supabase, clienteId) : 0;
  rafraichir(clienteId, programmeId);
  if (nb) return { succes: `Date arrivée : le programme est en ligne, ${v.prenom} est prévenue.` };
  return { succes: date ? "Programme planifié : il passera en ligne tout seul à cette date." : "Programme retiré du planning (il reste en brouillon)." };
}
