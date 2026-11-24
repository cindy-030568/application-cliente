"use server";

import { revalidatePath } from "next/cache";
import { DUREES_EXPRESS, NIVEAUX_EXPRESS, extraireSeance, lireListe } from "@/lib/seances-express";
import { SESSION_PERDUE, UUID, sessionCoach } from "../clientes/verification";

export type EtatExpress = { erreur?: string; succes?: string; id?: string };
const MIGRATION = "Fais d’abord la mise à jour de la base : fichier 0040_seances_express.sql (voir le guide).";
const erreurBase = (code?: string) => (["42P01", "PGRST205", "42703", "PGRST204"].includes(code ?? "") ? MIGRATION : "L’enregistrement a échoué. Réessaie.");

function rafraichir() {
  revalidatePath("/coach/seances-express");
  revalidatePath("/seances-express");
}

/** Crée ou modifie une séance express. Le contenu vient de Claude (collé) ; vide en modification = on garde l'actuel. */
export async function enregistrerSeanceExpress(id: string | null, _e: EtatExpress, formData: FormData): Promise<EtatExpress> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (id && !UUID.test(id)) return { erreur: "Séance introuvable." };
  const titre = String(formData.get("titre") ?? "").trim().slice(0, 100);
  const description = String(formData.get("description") ?? "").trim().slice(0, 500) || null;
  const duree = Number(formData.get("duree"));
  const type = String(formData.get("type") ?? "").trim().slice(0, 40);
  const niveau = String(formData.get("niveau") ?? "tous");
  const materiel = formData.getAll("materiel").map((m) => String(m).trim().slice(0, 40)).filter(Boolean).slice(0, 15);
  const visibilite = formData.get("visibilite") === "certaines" ? "certaines" : "toutes";
  const clientes = formData.getAll("clientes").map(String).filter((c) => UUID.test(c));
  const colle = String(formData.get("contenu") ?? "");
  if (!titre) return { erreur: "Donne un titre à la séance." };
  if (!(DUREES_EXPRESS as readonly number[]).includes(duree)) return { erreur: "Choisis la durée." };
  if (!type) return { erreur: "Choisis le type de séance." };
  if (!NIVEAUX_EXPRESS.some((n) => n.code === niveau)) return { erreur: "Choisis le niveau." };
  if (visibilite === "certaines" && !clientes.length) return { erreur: "Choisis au moins une cliente, ou rends la séance visible par toutes." };

  let contenu: unknown = undefined;
  if (colle.trim() || !id) {
    const r = extraireSeance(colle);
    if (!r.seance) return { erreur: r.erreur };
    contenu = { ...r.seance, nom: titre };
  }
  const valeurs = {
    titre,
    description,
    duree_minutes: duree,
    type,
    niveau,
    materiel,
    visibilite,
    // En modification, la publication se règle avec le bouton « Publier » / « Repasser en brouillon ».
    ...(formData.get("avec_publication") === "1" ? { publiee: formData.get("publiee") === "on" } : {}),
    ...(contenu ? { contenu } : {}),
  };
  const { supabase } = session;
  let seanceId = id;
  if (id) {
    const { error } = await supabase.from("seances_express").update(valeurs).eq("id", id);
    if (error) return { erreur: erreurBase(error.code) };
  } else {
    const { data, error } = await supabase.from("seances_express").insert(valeurs).select("id").single();
    if (error || !data) return { erreur: erreurBase(error?.code) };
    seanceId = data.id as string;
  }
  await supabase.from("seances_express_clientes").delete().eq("seance_id", seanceId);
  if (visibilite === "certaines") {
    const { error } = await supabase.from("seances_express_clientes").insert(clientes.map((cliente_id) => ({ seance_id: seanceId, cliente_id })));
    if (error) return { erreur: "La séance est enregistrée, mais pas le choix des clientes.", id: seanceId ?? undefined };
  }
  rafraichir();
  revalidatePath(`/coach/seances-express/${seanceId}`);
  return { succes: id ? "Séance enregistrée ✓" : "Séance créée ✓", id: seanceId ?? undefined };
}

export async function publierSeanceExpress(id: string, publiee: boolean): Promise<EtatExpress> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(id)) return { erreur: "Séance introuvable." };
  const { error } = await session.supabase.from("seances_express").update({ publiee }).eq("id", id);
  if (error) return { erreur: erreurBase(error.code) };
  rafraichir();
  return { succes: publiee ? "Publiée ✓" : "Repassée en brouillon." };
}

export async function supprimerSeanceExpress(id: string): Promise<EtatExpress> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(id)) return { erreur: "Séance introuvable." };
  const { error } = await session.supabase.from("seances_express").delete().eq("id", id);
  if (error) return { erreur: erreurBase(error.code) };
  rafraichir();
  return { succes: "Séance supprimée." };
}

/** Réglages : listes de matériel et de types (une valeur par ligne). */
export async function enregistrerListesExpress(_e: EtatExpress, formData: FormData): Promise<EtatExpress> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const materiel = lireListe(String(formData.get("materiel") ?? ""));
  const types = lireListe(String(formData.get("types") ?? ""));
  if (!materiel.length || !types.length) return { erreur: "Garde au moins une valeur dans chaque liste." };
  const { error } = await session.supabase.from("reglages").update({ express_materiel: materiel, express_types: types }).eq("id", true);
  if (error) return { erreur: erreurBase(error.code) };
  revalidatePath("/coach/reglages");
  revalidatePath("/coach/seances-express");
  return { succes: "Listes enregistrées ✓" };
}

/** Fiche cliente : accès aux séances express après le suivi (jusqu'à une date ; vide = pas d'accès). */
export async function definirAccesExpress(clienteId: string, _e: EtatExpress, formData: FormData): Promise<EtatExpress> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(clienteId)) return { erreur: "Cliente introuvable." };
  const brut = String(formData.get("express_jusqu_au") ?? "");
  if (brut && !/^\d{4}-\d{2}-\d{2}$/.test(brut)) return { erreur: "La date n’est pas valide." };
  const { error } = await session.supabase.from("clientes").update({ express_jusqu_au: brut || null }).eq("id", clienteId);
  if (error) return { erreur: erreurBase(error.code) };
  revalidatePath(`/coach/clientes/${clienteId}`);
  return { succes: brut ? "Accès enregistré ✓" : "Accès retiré." };
}
