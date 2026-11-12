"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import depart from "../../../../data/recettes-depart.json";
import { normaliser } from "@/lib/texte";
import { SESSION_PERDUE, UUID, sessionCoach } from "../clientes/verification";

export type EtatRecette = { erreur?: string; succes?: string };

const ROLES = ["proteine", "glucide", "lipide", "fruit", "fixe"] as const;
const REPAS = ["petit_dejeuner", "dejeuner", "diner", "collation"] as const;

export type IngredientSaisi = {
  aliment_id: string;
  role: (typeof ROLES)[number];
  unite: "g" | "unite";
  qte_base: number;
  qte_min: number;
  qte_max: number;
  pas: number;
  note: string | null;
};

function rafraichir() {
  revalidatePath("/coach/recettes", "layout");
  revalidatePath("/recettes", "layout");
}

/** Contrôle d'un ingrédient (mêmes règles que la base de données, avec des messages clairs). */
function verifierIngredient(i: IngredientSaisi, n: number): string | null {
  if (!UUID.test(i.aliment_id)) return `Ingrédient ${n} : aliment introuvable.`;
  if (!ROLES.includes(i.role)) return `Ingrédient ${n} : rôle inconnu.`;
  if (!["g", "unite"].includes(i.unite)) return `Ingrédient ${n} : unité inconnue.`;
  for (const v of [i.qte_base, i.qte_min, i.qte_max, i.pas]) {
    if (!Number.isFinite(v) || v < 0 || v > 5000) return `Ingrédient ${n} : une quantité n’est pas valide.`;
  }
  if (i.qte_base <= 0 || i.pas <= 0) return `Ingrédient ${n} : la quantité de base et le pas doivent être supérieurs à 0.`;
  if (i.role === "fixe" && (i.qte_min !== i.qte_base || i.qte_max !== i.qte_base)) {
    return `Ingrédient ${n} : un ingrédient fixe garde toujours sa quantité de base.`;
  }
  if (!(i.qte_min <= i.qte_base && i.qte_base <= i.qte_max)) {
    return `Ingrédient ${n} : la quantité de base doit être entre le minimum et le maximum.`;
  }
  return null;
}

export async function enregistrerRecette(id: string | null, _e: EtatRecette, formData: FormData): Promise<EtatRecette> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const { supabase } = session;

  const titre = String(formData.get("titre") ?? "").trim().slice(0, 120);
  if (!titre) return { erreur: "Le titre est obligatoire." };
  const repas = formData.getAll("repas").map(String).filter((r): r is (typeof REPAS)[number] => (REPAS as readonly string[]).includes(r));
  if (repas.length === 0) return { erreur: "Coche au moins un type de repas." };
  const tags = formData.getAll("tags").map(String).filter((t) => UUID.test(t));
  const temps = Number(formData.get("temps_prep_min") || 0);
  let ingredients: IngredientSaisi[];
  try {
    ingredients = JSON.parse(String(formData.get("ingredients") ?? "[]"));
  } catch {
    return { erreur: "Les ingrédients n’ont pas pu être lus." };
  }
  if (!Array.isArray(ingredients) || ingredients.length === 0) return { erreur: "Ajoute au moins un ingrédient." };
  if (ingredients.length > 30) return { erreur: "30 ingrédients maximum." };
  for (const [k, i] of ingredients.entries()) {
    const e = verifierIngredient(i, k + 1);
    if (e) return { erreur: e };
  }
  const { data: aliments } = await supabase
    .from("aliments")
    .select("id, poids_unite_g")
    .in("id", [...new Set(ingredients.map((i) => i.aliment_id))]);
  const unite = new Map((aliments ?? []).map((a) => [a.id as string, a.poids_unite_g]));
  for (const [k, i] of ingredients.entries()) {
    if (!unite.has(i.aliment_id)) return { erreur: `Ingrédient ${k + 1} : aliment introuvable.` };
    if (i.unite === "unite" && !unite.get(i.aliment_id)) {
      return { erreur: `Ingrédient ${k + 1} : cet aliment n’a pas d’unité (renseigne-la dans Aliments).` };
    }
  }

  const photo = String(formData.get("photo_path") ?? "") || null;
  if (photo && !/^[0-9a-f-]{36}\.jpg$/.test(photo)) return { erreur: "Photo invalide." };

  const valeurs = {
    titre,
    description: String(formData.get("description") ?? "").trim().slice(0, 400) || null,
    temps_prep_min: Number.isInteger(temps) && temps > 0 && temps <= 600 ? temps : null,
    etapes: String(formData.get("etapes") ?? "")
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*(\d+[.)]|[-•*])\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 20),
    astuce: String(formData.get("astuce") ?? "").trim().slice(0, 600) || null,
    publiee: formData.get("publiee") === "on",
    photo_path: photo,
  };

  let recetteId = id;
  if (id) {
    if (!UUID.test(id)) return { erreur: "Recette introuvable." };
    const { error } = await supabase.from("recettes").update(valeurs).eq("id", id);
    if (error) return { erreur: error.code === "23505" ? "Une recette porte déjà ce titre." : "L’enregistrement a échoué." };
  } else {
    const { data, error } = await supabase.from("recettes").insert(valeurs).select("id").single();
    if (error || !data) return { erreur: error?.code === "23505" ? "Une recette porte déjà ce titre." : "L’enregistrement a échoué." };
    recetteId = data.id as string;
  }

  await supabase.from("recette_ingredients").delete().eq("recette_id", recetteId);
  const { error: e1 } = await supabase
    .from("recette_ingredients")
    .insert(ingredients.map((i, ordre) => ({ ...i, note: i.note?.slice(0, 80) || null, recette_id: recetteId, ordre })));
  if (e1) return { erreur: "La recette est enregistrée, mais pas ses ingrédients. Vérifie les quantités." };
  await supabase.from("recettes_repas").delete().eq("recette_id", recetteId);
  await supabase.from("recettes_repas").insert(repas.map((type_repas) => ({ recette_id: recetteId, type_repas })));
  await supabase.from("recettes_tags").delete().eq("recette_id", recetteId);
  if (tags.length) await supabase.from("recettes_tags").insert(tags.map((tag_id) => ({ recette_id: recetteId, tag_id })));

  rafraichir();
  if (!id) redirect(`/coach/recettes/${recetteId}?creee=1`);
  return { succes: "Recette enregistrée." };
}

export async function supprimerRecette(id: string): Promise<EtatRecette> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(id)) return { erreur: "Recette introuvable." };
  const { data } = await session.supabase.from("recettes").select("photo_path").eq("id", id).maybeSingle();
  const { error } = await session.supabase.from("recettes").delete().eq("id", id);
  if (error) return { erreur: "La suppression a échoué." };
  if (data?.photo_path) await session.supabase.storage.from("recettes").remove([data.photo_path]);
  rafraichir();
  redirect("/coach/recettes?supprimee=1");
}

/** Autorisation d'envoi direct d'une photo de recette (bucket public « recettes »). */
export async function preparerPhotoRecette(): Promise<{ erreur?: string; chemin?: string; jeton?: string }> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const chemin = `${randomUUID()}.jpg`;
  const { data, error } = await session.supabase.storage.from("recettes").createSignedUploadUrl(chemin);
  if (error || !data) return { erreur: "La photo n’a pas pu être envoyée." };
  return { chemin: data.path, jeton: data.token };
}

type FichierDepart = {
  aliments_perso: { nom: string; p: number; g: number; l: number; k: number; categories: string[] }[];
  recettes: {
    titre: string; description: string | null; repas: string[]; temps: number; tags: string[]; etapes: string[]; astuce: string | null;
    anciens_titres?: string[];
    ingredients: { a: string; role: string; unite: string; base: number; min: number; max: number; pas: number; note: string | null }[];
  }[];
};

/**
 * Importe les recettes de départ.
 * Sans `mettreAJour`, les recettes déjà présentes (même titre, ou ancien titre) sont ignorées.
 * Avec `mettreAJour`, elles sont remises à jour (titre, textes, repas, tags, ingrédients) ;
 * la photo et l'état publié/brouillon sont conservés.
 */
export async function importerRecettesDepart(mettreAJour = false): Promise<EtatRecette> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const { supabase } = session;
  const fichier = depart as FichierDepart;

  const codes = [...new Set(fichier.recettes.flatMap((r) => r.ingredients.map((i) => i.a)).filter((a) => a.startsWith("ciqual:")).map((a) => a.slice(7)))];
  const { data: ciqual } = await supabase.from("aliments").select("id, code_ciqual, nom, poids_unite_g").in("code_ciqual", codes);
  const parCode = new Map((ciqual ?? []).map((a) => [a.code_ciqual as string, a.id as string]));
  const manquants = codes.filter((c) => !parCode.has(c));
  if (manquants.length) return { erreur: "Importe d’abord la table Ciqual (menu Aliments), puis relance l’import des recettes." };
  const sansUnite = (ciqual ?? []).filter(
    (a) => !a.poids_unite_g && fichier.recettes.some((r) => r.ingredients.some((i) => i.a === `ciqual:${a.code_ciqual}` && i.unite === "unite")),
  );
  if (sansUnite.length) {
    return { erreur: `Renseigne d’abord le poids d’une unité pour : ${sansUnite.map((a) => a.nom).join(", ")} (menu Aliments).` };
  }

  const { data: categories } = await supabase.from("categories_aliment").select("id, nom");
  const idCategorie = new Map((categories ?? []).map((c) => [c.nom as string, c.id as string]));
  const parNomPerso = new Map<string, string>();
  for (const a of fichier.aliments_perso) {
    const { data: existant } = await supabase.from("aliments").select("id").eq("source", "perso").eq("nom", a.nom).maybeSingle();
    let alimentId = existant?.id as string | undefined;
    if (!alimentId) {
      const { data, error } = await supabase
        .from("aliments")
        .insert({ source: "perso", nom: a.nom, nom_recherche: normaliser(a.nom), proteines_100: a.p, glucides_100: a.g, lipides_100: a.l, kcal_100: a.k, categories_verifiees: true })
        .select("id")
        .single();
      if (error || !data) return { erreur: `L’aliment « ${a.nom} » n’a pas pu être créé.` };
      alimentId = data.id as string;
      const liens = a.categories.flatMap((c) => (idCategorie.get(c) ? [{ aliment_id: alimentId, categorie_id: idCategorie.get(c)! }] : []));
      if (liens.length) await supabase.from("aliments_categories").insert(liens);
    }
    parNomPerso.set(a.nom, alimentId);
  }

  const { data: tags } = await supabase.from("tags").select("id, nom");
  const idTag = new Map((tags ?? []).map((t) => [t.nom as string, t.id as string]));
  const { data: existantes } = await supabase.from("recettes").select("id, titre");
  const idParTitre = new Map((existantes ?? []).map((r) => [r.titre as string, r.id as string]));

  let ajoutees = 0;
  let misesAJour = 0;
  for (const r of fichier.recettes) {
    const idExistant = [r.titre, ...(r.anciens_titres ?? [])].map((t) => idParTitre.get(t)).find(Boolean);
    if (idExistant && !mettreAJour) continue;
    const champs = { titre: r.titre, description: r.description, temps_prep_min: r.temps, etapes: r.etapes, astuce: r.astuce };
    let id: string;
    if (idExistant) {
      const { error } = await supabase.from("recettes").update(champs).eq("id", idExistant);
      if (error) return { erreur: `La recette « ${r.titre} » n’a pas pu être mise à jour (${misesAJour} mises à jour avant elle).` };
      id = idExistant;
      await Promise.all([
        supabase.from("recettes_repas").delete().eq("recette_id", id),
        supabase.from("recettes_tags").delete().eq("recette_id", id),
        supabase.from("recette_ingredients").delete().eq("recette_id", id),
      ]);
    } else {
      const { data, error } = await supabase.from("recettes").insert({ ...champs, publiee: true }).select("id").single();
      if (error || !data) return { erreur: `La recette « ${r.titre} » n’a pas pu être importée (${ajoutees} importées avant elle).` };
      id = data.id as string;
    }
    await supabase.from("recettes_repas").insert(r.repas.map((type_repas) => ({ recette_id: id, type_repas })));
    const t = r.tags.flatMap((nom) => (idTag.get(nom) ? [{ recette_id: id, tag_id: idTag.get(nom)! }] : []));
    if (t.length) await supabase.from("recettes_tags").insert(t);
    const { error: e2 } = await supabase.from("recette_ingredients").insert(
      r.ingredients.map((i, ordre) => ({
        recette_id: id,
        aliment_id: i.a.startsWith("ciqual:") ? parCode.get(i.a.slice(7))! : parNomPerso.get(i.a.slice(6))!,
        role: i.role,
        unite: i.unite,
        qte_base: i.base,
        qte_min: i.min,
        qte_max: i.max,
        pas: i.pas,
        note: i.note,
        ordre,
      })),
    );
    if (e2) {
      if (!idExistant) await supabase.from("recettes").delete().eq("id", id);
      return { erreur: `Les ingrédients de « ${r.titre} » n’ont pas pu être enregistrés. Relance l’opération.` };
    }
    if (idExistant) misesAJour++;
    else ajoutees++;
  }
  rafraichir();
  if (mettreAJour) return { succes: `${misesAJour} recettes mises à jour, ${ajoutees} ajoutées.` };
  return { succes: ajoutees ? `${ajoutees} recettes importées.` : "Toutes les recettes de départ sont déjà là." };
}
