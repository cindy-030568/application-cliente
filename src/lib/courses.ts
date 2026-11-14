import { nomIngredient } from "@/lib/noms-aliments";
/**
 * Liste de courses : rayons, regroupement des articles, texte à partager.
 * Module pur, sans base de données : entièrement testable.
 */
import { formaterQuantite } from "@/lib/nutrition";

/** Nombre de portions proposé sur une fiche recette (batch cooking). */
export const PORTIONS_MAX = 4;

export const RAYONS = [
  "Fruits & légumes",
  "Viandes & poissons",
  "Crèmerie & œufs",
  "Féculents & pain",
  "Épicerie salée",
  "Épicerie sucrée",
  "Boissons",
  "Divers",
] as const;
export type Rayon = (typeof RAYONS)[number];

/** Rayon déduit des catégories d'exclusion, pour les aliments sans groupe Ciqual (aliments perso…). */
function rayonParCategories(categories: string[]): Rayon {
  const c = new Set(categories);
  if (c.has("Produits laitiers") || c.has("Œuf")) return "Crèmerie & œufs";
  if (["Viande", "Volaille", "Porc", "Poisson", "Fruits de mer"].some((x) => c.has(x))) return "Viandes & poissons";
  if (c.has("Gluten")) return "Féculents & pain";
  if (["Fruits à coque", "Arachide", "Sésame"].some((x) => c.has(x))) return "Épicerie salée";
  return "Divers";
}

/** Rayon du supermarché d'après le groupe et le sous-groupe Ciqual de l'aliment (sinon ses catégories). */
export function rayonPour(groupe: string | null, sousGroupe: string | null, categories: string[] = [], nom = ""): Rayon {
  const g = groupe ?? "";
  const sg = sousGroupe ?? "";
  if (!g) return rayonParCategories(categories);
  if (g.startsWith("fruits, légumes")) {
    if (sg === "légumineuses" || sg.startsWith("fruits à coque")) return "Épicerie salée";
    return "Fruits & légumes";
  }
  if (g.startsWith("viandes")) return sg === "œufs" ? "Crèmerie & œufs" : "Viandes & poissons";
  if (g.startsWith("produits laitiers")) return "Crèmerie & œufs";
  if (g.startsWith("matières grasses")) return sg === "beurres" || sg === "margarines" ? "Crèmerie & œufs" : "Épicerie salée";
  if (g.startsWith("produits céréaliers")) return "Féculents & pain";
  if (g.startsWith("produits sucrés")) return sg.startsWith("céréales") ? "Féculents & pain" : "Épicerie sucrée";
  if (g.startsWith("aides culinaires")) return "Épicerie salée";
  if (g.startsWith("eaux")) return /poudre/i.test(nom) ? "Épicerie sucrée" : "Boissons";
  return "Divers";
}

export type LigneCourses = {
  id: string;
  aliment_id: string | null;
  nom: string;
  rayon: string;
  quantite: number | null;
  unite: "g" | "unite" | null;
  nom_unite: string | null;
  coche: boolean;
};

export type ArticleRegroupe = {
  /** Identifiant stable de l'article regroupé (aliment, ou nom pour un article libre). */
  cle: string;
  nom: string;
  grammes: number;
  unites: number;
  nomUnite: string | null;
  coche: boolean;
  ids: string[];
};

export type SectionCourses = { rayon: string; articles: ArticleRegroupe[] };

function cleDe(l: LigneCourses): string {
  return l.aliment_id ? `a:${l.aliment_id}` : `n:${l.nom.trim().toLocaleLowerCase("fr")}`;
}

/**
 * Additionne les quantités d'un même aliment (toutes recettes confondues),
 * regroupées par rayon, dans l'ordre des rayons puis alphabétique.
 * Un article est coché quand toutes ses lignes le sont.
 */
export function regrouperCourses(lignes: LigneCourses[]): SectionCourses[] {
  const parCle = new Map<string, ArticleRegroupe & { rayon: string }>();
  for (const l of lignes) {
    const cle = cleDe(l);
    let a = parCle.get(cle);
    if (!a) {
      a = { cle, nom: l.nom, rayon: l.rayon, grammes: 0, unites: 0, nomUnite: null, coche: true, ids: [] };
      parCle.set(cle, a);
    }
    if (l.unite === "g" && l.quantite) a.grammes += l.quantite;
    if (l.unite === "unite" && l.quantite) {
      a.unites += l.quantite;
      a.nomUnite ??= l.nom_unite;
    }
    a.coche &&= l.coche;
    a.ids.push(l.id);
  }
  const ordre = (r: string) => {
    const i = (RAYONS as readonly string[]).indexOf(r);
    return i === -1 ? RAYONS.length : i;
  };
  const sections = new Map<string, ArticleRegroupe[]>();
  for (const { rayon, ...a } of parCle.values()) {
    a.grammes = Math.round(a.grammes);
    sections.set(rayon, [...(sections.get(rayon) ?? []), a]);
  }
  return [...sections.entries()]
    .sort(([r1], [r2]) => ordre(r1) - ordre(r2) || r1.localeCompare(r2, "fr"))
    .map(([rayon, articles]) => ({
      rayon,
      articles: articles.sort((x, y) => Number(x.coche) - Number(y.coche) || x.nom.localeCompare(y.nom, "fr")),
    }));
}

/** « 240 g », « 3 œufs », « 2 œufs + 60 g », ou rien pour un article sans quantité. */
export function quantiteArticle(a: Pick<ArticleRegroupe, "grammes" | "unites" | "nomUnite">): string {
  const parts: string[] = [];
  if (a.unites > 0) parts.push(formaterQuantite(a.unites, "unite", a.nomUnite));
  if (a.grammes > 0) parts.push(formaterQuantite(a.grammes, "g", null));
  return parts.join(" + ");
}

/** Texte brut de la liste (articles non cochés), pour l'envoyer par message. */
export function texteCourses(sections: SectionCourses[]): string {
  const blocs = sections
    .map((s) => ({ rayon: s.rayon, articles: s.articles.filter((a) => !a.coche) }))
    .filter((s) => s.articles.length > 0)
    .map((s) => {
      const lignes = s.articles.map((a) => {
        const q = quantiteArticle(a);
        return `- ${a.nom}${q ? ` : ${q}` : ""}`;
      });
      return [s.rayon.toLocaleUpperCase("fr"), ...lignes].join("\n");
    });
  return blocs.length ? ["Ma liste de courses", "", blocs.join("\n\n")].join("\n") : "";
}


/** Nom court d'un aliment pour une liste de courses (« Avocat, pulpe, cru » → « Avocat »). */
export function nomCourt(nom: string): string {
  return nomIngredient(nom).replace(/\s+(crue?s?|cuite?s?)$/i, "");
}
