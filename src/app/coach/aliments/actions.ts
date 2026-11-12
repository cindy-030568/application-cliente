"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import ciqual from "../../../../data/ciqual.json";
import { rechercherAliments } from "@/lib/aliments";
import { normaliser } from "@/lib/texte";
import type { Aliment } from "@/lib/types";
import { SESSION_PERDUE, UUID, sessionCoach } from "../clientes/verification";

export type EtatAliment = { erreur?: string; succes?: string };

type LigneCiqual = {
  c: string; n: string; g: string | null; sg: string | null;
  p: number; gl: number; l: number; k: number; i: boolean; cat: string[];
};

/** Unités proposées par défaut (modifiables ensuite par la coach). */
const UNITES_PAR_DEFAUT: Record<string, [string, number]> = {
  "22000": ["œuf", 50],
  "13005": ["banane", 120],
  "13039": ["pomme", 150],
  "13021": ["kiwi", 75],
  "7111": ["tranche", 25],
  "7200": ["tranche", 25],
  "7110": ["tranche", 40],
  "7815": ["tortilla", 40],
  "7352": ["galette", 9],
  "31074": ["carré", 5],
};

/** Importe ou met à jour la table Ciqual (sans écraser les unités ni les catégories vérifiées). */
export async function importerCiqual(): Promise<EtatAliment> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const { supabase } = session;
  const lignes = (ciqual as { aliments: LigneCiqual[] }).aliments;

  for (let i = 0; i < lignes.length; i += 500) {
    const lot = lignes.slice(i, i + 500).map((a) => ({
      source: "ciqual",
      code_ciqual: a.c,
      nom: a.n,
      nom_recherche: normaliser(a.n),
      groupe: a.g,
      sous_groupe: a.sg,
      proteines_100: Math.min(a.p, 100),
      glucides_100: Math.min(a.gl, 100),
      lipides_100: Math.min(a.l, 100),
      kcal_100: Math.min(a.k, 950),
      incomplet: a.i,
    }));
    const { error } = await supabase.from("aliments").upsert(lot, { onConflict: "code_ciqual" });
    if (error) return { erreur: `L’import s’est arrêté (lot ${i / 500 + 1}). Relance-le : il reprendra sans doublon.` };
  }

  // Identifiants, par pages de 1000 (limite du serveur).
  const ids = new Map<string, { id: string; verifiees: boolean; unite: string | null }>();
  for (let debut = 0; ; debut += 1000) {
    const { data } = await supabase
      .from("aliments")
      .select("id, code_ciqual, categories_verifiees, nom_unite")
      .eq("source", "ciqual")
      .order("code_ciqual")
      .range(debut, debut + 999);
    for (const a of data ?? []) ids.set(a.code_ciqual as string, { id: a.id, verifiees: a.categories_verifiees, unite: a.nom_unite });
    if (!data || data.length < 1000) break;
  }

  // Catégories proposées automatiquement, seulement pour les aliments non vérifiés par la coach.
  const { data: categories } = await supabase.from("categories_aliment").select("id, nom");
  const idCategorie = new Map((categories ?? []).map((c) => [c.nom as string, c.id as string]));
  const aMettreAJour = lignes.filter((a) => ids.get(a.c) && !ids.get(a.c)!.verifiees);
  const idsAMettreAJour = aMettreAJour.map((a) => ids.get(a.c)!.id);
  // Lots de 150 identifiants : l'adresse de la requête reste courte.
  for (let i = 0; i < idsAMettreAJour.length; i += 150) {
    await supabase.from("aliments_categories").delete().in("aliment_id", idsAMettreAJour.slice(i, i + 150));
  }
  const liens = aMettreAJour.flatMap((a) =>
    a.cat.flatMap((nom) => (idCategorie.get(nom) ? [{ aliment_id: ids.get(a.c)!.id, categorie_id: idCategorie.get(nom)! }] : [])),
  );
  for (let i = 0; i < liens.length; i += 1000) {
    await supabase.from("aliments_categories").insert(liens.slice(i, i + 1000));
  }

  for (const [code, [nom_unite, poids_unite_g]] of Object.entries(UNITES_PAR_DEFAUT)) {
    const a = ids.get(code);
    if (a && !a.unite) await supabase.from("aliments").update({ nom_unite, poids_unite_g }).eq("id", a.id);
  }

  revalidatePath("/coach/aliments", "layout");
  return { succes: `${lignes.length} aliments Ciqual importés.` };
}

function nombre(formData: FormData, cle: string): number | null {
  const v = String(formData.get(cle) ?? "").trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export async function enregistrerAliment(id: string | null, _e: EtatAliment, formData: FormData): Promise<EtatAliment> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const { supabase } = session;

  let source: "ciqual" | "perso" = "perso";
  if (id) {
    if (!UUID.test(id)) return { erreur: "Aliment introuvable." };
    const { data } = await supabase.from("aliments").select("source").eq("id", id).maybeSingle();
    if (!data) return { erreur: "Aliment introuvable." };
    source = data.source;
  }

  const nomUnite = String(formData.get("nom_unite") ?? "").trim().slice(0, 30) || null;
  const poidsUnite = nombre(formData, "poids_unite_g");
  if ((nomUnite === null) !== (poidsUnite === null) || (poidsUnite !== null && (Number.isNaN(poidsUnite) || poidsUnite <= 0))) {
    return { erreur: "Pour une unité, indique son nom ET son poids moyen en grammes (ou laisse les deux vides)." };
  }
  const valeurs: Record<string, unknown> = {
    nom_unite: nomUnite,
    poids_unite_g: poidsUnite,
    actif: formData.get("actif") === "on",
    categories_verifiees: true,
  };

  if (source === "perso") {
    const nom = String(formData.get("nom") ?? "").trim().slice(0, 200);
    if (!nom) return { erreur: "Le nom est obligatoire." };
    const p = nombre(formData, "proteines_100");
    const g = nombre(formData, "glucides_100");
    const l = nombre(formData, "lipides_100");
    let k = nombre(formData, "kcal_100");
    for (const v of [p, g, l]) {
      if (v === null || Number.isNaN(v) || v < 0 || v > 100) {
        return { erreur: "Protéines, glucides et lipides : entre 0 et 100 g pour 100 g." };
      }
    }
    if (k === null) k = Math.round(4 * p! + 4 * g! + 9 * l!);
    if (Number.isNaN(k) || k < 0 || k > 950) return { erreur: "Les kcal pour 100 g ne sont pas valides." };
    Object.assign(valeurs, {
      nom,
      nom_recherche: normaliser(nom),
      proteines_100: p,
      glucides_100: g,
      lipides_100: l,
      kcal_100: k,
      incomplet: false,
    });
  }

  let alimentId = id;
  if (id) {
    const { error } = await supabase.from("aliments").update(valeurs).eq("id", id);
    if (error) return { erreur: "L’enregistrement a échoué." };
  } else {
    const { data, error } = await supabase
      .from("aliments")
      .insert({ ...valeurs, source: "perso" })
      .select("id")
      .single();
    if (error || !data) return { erreur: "L’enregistrement a échoué." };
    alimentId = data.id as string;
  }

  const categories = formData.getAll("categories").map(String).filter((c) => UUID.test(c));
  await supabase.from("aliments_categories").delete().eq("aliment_id", alimentId);
  if (categories.length) {
    await supabase.from("aliments_categories").insert(categories.map((categorie_id) => ({ aliment_id: alimentId, categorie_id })));
  }

  revalidatePath("/coach/aliments", "layout");
  if (!id) redirect(`/coach/aliments?q=${encodeURIComponent(String(formData.get("nom") ?? ""))}&ajoute=1`);
  return { succes: "Aliment enregistré." };
}

export async function supprimerAliment(id: string): Promise<EtatAliment> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(id)) return { erreur: "Aliment introuvable." };
  const { error } = await session.supabase.from("aliments").delete().eq("id", id).eq("source", "perso");
  if (error) return { erreur: "Cet aliment est utilisé dans une recette : décoche plutôt « Proposé dans les recherches »." };
  revalidatePath("/coach/aliments", "layout");
  redirect("/coach/aliments?supprime=1");
}

/** Recherche pour l'éditeur de recettes. */
export async function chercherAliments(q: string): Promise<Aliment[]> {
  const session = await sessionCoach();
  if (!session || q.trim().length < 2) return [];
  return rechercherAliments(session.supabase, q, { limite: 15, actifsSeulement: true });
}
