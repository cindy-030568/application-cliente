"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { envoyerPushCliente } from "@/lib/envoi-rappels";
import { ajouterJours, aujourdhuiParis } from "@/lib/bilan";
import { extraireProgramme, renouvellementParDefaut } from "@/lib/programme-sportif";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID, verifierCliente } from "./verification";

export type EtatProgramme = { erreur?: string; succes?: string };

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
  const r = extraireProgramme(String(formData.get("reponse") ?? "").slice(0, 300000));
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
