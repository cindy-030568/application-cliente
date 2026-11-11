"use server";

import { revalidatePath } from "next/cache";
import { SESSION_PERDUE, UUID, sessionCoach } from "../clientes/verification";

export type EtatChamps = { erreur?: string; succes?: string };

function rafraichir() {
  revalidatePath("/coach/reglages");
  revalidatePath("/suivi", "layout");
}

function lireOptions(brut: string): string[] {
  return brut
    .split(/[\n,]/)
    .map((o) => o.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 12);
}

export async function ajouterChamp(_e: EtatChamps, formData: FormData): Promise<EtatChamps> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const libelle = String(formData.get("libelle") ?? "").trim().slice(0, 60);
  const type = String(formData.get("type") ?? "");
  if (!libelle) return { erreur: "Donne un nom au champ." };
  if (!["nombre", "echelle", "choix"].includes(type)) return { erreur: "Choisis le type de champ." };
  const options = type === "choix" ? lireOptions(String(formData.get("options") ?? "")) : null;
  if (type === "choix" && (options?.length ?? 0) < 2) return { erreur: "Indique au moins deux choix, séparés par des virgules." };

  const { data: max } = await session.supabase
    .from("champs_mesure")
    .select("ordre")
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await session.supabase.from("champs_mesure").insert({
    groupe: type === "nombre" ? "mesure" : "ressenti",
    type,
    libelle,
    unite: type === "nombre" ? String(formData.get("unite") ?? "").trim().slice(0, 10) || null : null,
    aide: String(formData.get("aide") ?? "").trim().slice(0, 160) || null,
    options,
    ordre: (max?.ordre ?? 0) + 1,
  });
  if (error) return { erreur: "Le champ n’a pas pu être ajouté." };
  rafraichir();
  return { succes: "Champ ajouté au bilan." };
}

export async function modifierChamp(id: string, valeurs: { libelle: string; aide: string; unite: string }): Promise<EtatChamps> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(id)) return { erreur: "Champ introuvable." };
  const libelle = valeurs.libelle.trim().slice(0, 60);
  if (!libelle) return { erreur: "Le nom ne peut pas être vide." };
  const { error } = await session.supabase
    .from("champs_mesure")
    .update({ libelle, aide: valeurs.aide.trim().slice(0, 160) || null, unite: valeurs.unite.trim().slice(0, 10) || null })
    .eq("id", id);
  if (error) return { erreur: "La modification a échoué." };
  rafraichir();
  return {};
}

export async function basculerChamp(id: string, actif: boolean): Promise<EtatChamps> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(id)) return { erreur: "Champ introuvable." };
  const { error } = await session.supabase.from("champs_mesure").update({ actif }).eq("id", id);
  if (error) return { erreur: "La modification a échoué." };
  rafraichir();
  return {};
}

export async function deplacerChamp(id: string, sens: -1 | 1): Promise<EtatChamps> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const { data: champs } = await session.supabase.from("champs_mesure").select("id, ordre").order("ordre");
  const liste = champs ?? [];
  const i = liste.findIndex((c) => c.id === id);
  const j = i + sens;
  if (i < 0 || j < 0 || j >= liste.length) return {};
  [liste[i], liste[j]] = [liste[j], liste[i]];
  await Promise.all(
    liste.map((c, k) => session.supabase.from("champs_mesure").update({ ordre: k + 1 }).eq("id", c.id)),
  );
  rafraichir();
  return {};
}

export async function reglerFenetre(_e: EtatChamps, formData: FormData): Promise<EtatChamps> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const jours = Number(formData.get("fenetre_bilan_jours"));
  if (!Number.isInteger(jours) || jours < 0 || jours > 14) return { erreur: "Choisis entre 0 et 14 jours." };
  const { error } = await session.supabase.from("reglages").update({ fenetre_bilan_jours: jours }).eq("id", true);
  if (error) return { erreur: "L’enregistrement a échoué." };
  revalidatePath("/", "layout");
  return { succes: "Enregistré." };
}
