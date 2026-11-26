/**
 * Espace abonnées, étape 4 (cuisine) : logique pure, testée.
 * - le menu de la semaine que l'appli propose à la coach (elle le retouche ensuite) ;
 * - les étapes du batch cooking du dimanche, proposées d'après les recettes du menu ;
 * - les quantités de la liste de courses du menu ;
 * - « Avec ce que j'ai » : les recettes faisables avec ce qu'elle a chez elle.
 */
import { ajouterJours } from "./bilan";
import { nomCourt } from "./courses";
import { additionner, type QuantitePlanifiee } from "./planning";
import { lundiDe } from "./recap-semaine";
import { normaliser } from "./texte";
import type { IngredientRecette } from "./types";

export const REPAS_MENU = ["petit_dejeuner", "dejeuner", "collation", "diner"] as const;
export type RepasMenu = (typeof REPAS_MENU)[number];
export const LIBELLES_REPAS_MENU: Record<RepasMenu, string> = {
  petit_dejeuner: "Petit-déjeuner",
  dejeuner: "Déjeuner",
  collation: "Goûter",
  diner: "Dîner",
};
export const estRepasMenu = (x: unknown): x is RepasMenu => typeof x === "string" && (REPAS_MENU as readonly string[]).includes(x);
export const JOURS_SEMAINE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
/** « du 7 janvier au 13 janvier » */
export const periodeSemaine = (lundi: string) =>
  `du ${dateCourte.format(new Date(`${lundi}T00:00:00Z`))} au ${dateCourte.format(new Date(`${ajouterJours(lundi, 6)}T00:00:00Z`))}`;

/** Une case du menu : un jour (1 = lundi … 7 = dimanche), un repas, une recette. */
export type CaseMenu = { jour: number; repas: RepasMenu; recette_id: string };

type IngredientMenu = Pick<IngredientRecette, "aliment_id" | "role" | "unite" | "qte_base"> & {
  aliment: Pick<IngredientRecette["aliment"], "nom" | "nom_unite">;
};
export type RecetteMenu = { id: string; titre: string; repas: string[]; ingredients: IngredientMenu[] };

/** Petit générateur pseudo-aléatoire stable (la même semaine donne la même proposition). */
function aleatoire(graine: string) {
  let h = 2166136261;
  for (const c of graine) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function melanger<T>(liste: T[], hasard: () => number): T[] {
  const r = [...liste];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/**
 * Propose un menu complet (7 jours × 4 repas) à partir des recettes publiées.
 * - Les cases déjà remplies (`garder`) ne bougent pas : seules les cases vides sont complétées.
 * - Les recettes des semaines précédentes (`recentes`) passent en dernier.
 * - Pas deux fois la même recette dans la semaine pour un même repas s'il y a assez de choix,
 *   jamais deux jours de suite, et pas la même au déjeuner et au dîner d'un même jour.
 */
export function proposerMenu(recettes: Pick<RecetteMenu, "id" | "repas">[], o: { graine: string; recentes?: string[]; garder?: CaseMenu[] }): CaseMenu[] {
  const hasard = aleatoire(o.graine);
  const recentes = new Set(o.recentes ?? []);
  const cases = new Map<string, CaseMenu>();
  for (const c of o.garder ?? []) cases.set(`${c.jour}|${c.repas}`, c);
  for (const repas of REPAS_MENU) {
    const candidates = recettes.filter((r) => r.repas.includes(repas)).map((r) => r.id);
    if (!candidates.length) continue;
    // D'abord les recettes pas vues récemment, chacune dans un ordre mélangé.
    const ordre = [...melanger(candidates.filter((id) => !recentes.has(id)), hasard), ...melanger(candidates.filter((id) => recentes.has(id)), hasard)];
    const utilisees = new Map<string, number>();
    for (const c of cases.values()) if (c.repas === repas) utilisees.set(c.recette_id, (utilisees.get(c.recette_id) ?? 0) + 1);
    for (let jour = 1; jour <= 7; jour++) {
      if (cases.has(`${jour}|${repas}`)) continue;
      const veille = cases.get(`${jour - 1}|${repas}`)?.recette_id;
      const lendemain = cases.get(`${jour + 1}|${repas}`)?.recette_id;
      const memeJour = new Set(REPAS_MENU.map((r) => cases.get(`${jour}|${r}`)?.recette_id).filter(Boolean));
      const choix = [...ordre].sort((a, b) => (utilisees.get(a) ?? 0) - (utilisees.get(b) ?? 0));
      const id =
        choix.find((x) => x !== veille && x !== lendemain && !memeJour.has(x)) ??
        choix.find((x) => x !== veille && x !== lendemain) ??
        choix[0];
      cases.set(`${jour}|${repas}`, { jour, repas, recette_id: id });
      utilisees.set(id, (utilisees.get(id) ?? 0) + 1);
    }
  }
  return [...cases.values()].sort((a, b) => a.jour - b.jour || REPAS_MENU.indexOf(a.repas) - REPAS_MENU.indexOf(b.repas));
}

const PAIN = /pain|flocon|biscotte|galette|wrap|tortilla|muesli|granola|céréales/i;
const LEGUMINEUSE = /lentille|pois chiche|haricot (rouge|blanc|noir)|flageolet|fève|pois cassé/i;
const OEUF = /(œuf|oeuf)/i;
/** Se mangent tels quels : rien à cuire à l'avance. */
const SANS_CUISSON = /jambon|fumé|fume|surimi|thon (au naturel|en conserve|à l'huile)|sardine/i;
const VIANDE_POISSON = /poulet|dinde|bœuf|boeuf|veau|porc|jambon|saumon|thon|cabillaud|colin|poisson|crevette|steak|viande|filet|lardon|canard|merlu/i;

/** Liste lisible : « riz, quinoa et lentilles » (8 au plus). */
function enumerer(noms: string[]): string {
  const uniques = [...new Set(noms)].sort((a, b) => a.localeCompare(b, "fr"));
  const montres = uniques.slice(0, 8).map((n) => n.toLocaleLowerCase("fr"));
  if (uniques.length > 8) return `${montres.join(", ")}…`;
  return montres.length > 1 ? `${montres.slice(0, -1).join(", ")} et ${montres.at(-1)}` : (montres[0] ?? "");
}

/**
 * Étapes du batch cooking du dimanche, proposées d'après les déjeuners et dîners du menu
 * (la coach les relit et les réécrit à sa façon). Une étape par ligne.
 * `rayon` : le rayon de chaque aliment (pour reconnaître les légumes).
 */
export function proposerBatch(recettes: RecetteMenu[], rayon: (alimentId: string) => string): string {
  const principaux = recettes.filter((r) => r.repas.some((x) => x === "dejeuner" || x === "diner"));
  const tout = principaux.flatMap((r) => r.ingredients);
  const nom = (i: IngredientMenu) => nomCourt(i.aliment.nom);
  const legumes = tout.filter((i) => i.role === "fixe" && rayon(i.aliment_id) === "Fruits & légumes").map(nom);
  const feculents = tout.filter((i) => i.role === "glucide" && !PAIN.test(i.aliment.nom) && !LEGUMINEUSE.test(i.aliment.nom)).map(nom);
  const legumineuses = tout.filter((i) => LEGUMINEUSE.test(i.aliment.nom)).map(nom);
  const proteines = tout.filter((i) => i.role === "proteine" && VIANDE_POISSON.test(i.aliment.nom) && !SANS_CUISSON.test(i.aliment.nom)).map(nom);
  const oeufs = recettes.some((r) => r.ingredients.some((i) => OEUF.test(i.aliment.nom)));

  const etapes = ["🛒 Faire les courses avec la liste du menu."];
  if (legumes.length) etapes.push(`🥕 Laver, éplucher et couper les légumes : ${enumerer(legumes)}.`);
  if (feculents.length) etapes.push(`🍚 Cuire les féculents en avance : ${enumerer(feculents)}.`);
  if (legumineuses.length) etapes.push(`🫘 Cuire les légumineuses (ou rincer celles en bocal) : ${enumerer(legumineuses)}.`);
  if (proteines.length) etapes.push(`🍗 Cuire ou faire mariner les protéines : ${enumerer(proteines)}.`);
  if (oeufs) etapes.push("🥚 Faire cuire quelques œufs durs pour les collations et les salades.");
  etapes.push("📦 Ranger le tout dans des boîtes hermétiques : 3 à 4 jours au frigo, le reste au congélateur.");
  return etapes.join("\n");
}

/** Les étapes du batch, une par ligne (lignes vides ignorées). */
export const etapesBatch = (texte: string | null | undefined) => (texte ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

/** Les quantités de tout le menu (recettes en 1 portion × portions), additionnées par aliment. */
export function quantitesDuMenu(cases: CaseMenu[], recettes: RecetteMenu[], portions = 1): QuantitePlanifiee[] {
  const parId = new Map(recettes.map((r) => [r.id, r]));
  const lignes: QuantitePlanifiee[] = [];
  for (const c of cases) {
    for (const i of parId.get(c.recette_id)?.ingredients ?? []) {
      lignes.push({ aliment_id: i.aliment_id, nom: i.aliment.nom, unite: i.unite, nom_unite: i.unite === "unite" ? i.aliment.nom_unite : null, quantite: i.qte_base * portions });
    }
  }
  return additionner(lignes);
}

/** Le lot de courses d'un menu (sert aussi à le remplacer si elle recommence). */
export const titreLotMenu = (lundi: string) => `Menu de la semaine du ${lundi.slice(8, 10)}/${lundi.slice(5, 7)}`;

/**
 * Quelle semaine montrer à l'abonnée : celle en cours ; le dimanche, la suivante dès qu'elle est
 * publiée (c'est le jour du batch cooking). null s'il n'y a rien de publié.
 */
export function semaineAMontrer(aujourdhui: string, lundisPublies: string[]): string | null {
  const publies = new Set(lundisPublies);
  const cette = lundiDe(aujourdhui);
  const suivante = ajouterJours(cette, 7);
  const dimanche = aujourdhui === ajouterJours(cette, 6);
  if (dimanche && publies.has(suivante)) return suivante;
  if (publies.has(cette)) return cette;
  return null;
}

/** Jour du menu (1 = lundi … 7 = dimanche) pour une date, ou null hors de la semaine. */
export function jourDuMenu(lundi: string, date: string): number | null {
  for (let i = 0; i < 7; i++) if (ajouterJours(lundi, i) === date) return i + 1;
  return null;
}

// ---------------------------------------------------------------- Avec ce que j'ai

/** Ce qu'on a toujours dans ses placards : n'est jamais compté comme « manquant ». */
const BASIQUE = /^(sel|poivre|huile|eau|épices?|herbes|vinaigre|moutarde|curry|paprika|cumin|cannelle|curcuma|muscade|gingembre en poudre|thym|laurier|origan|basilic séché|levure|bicarbonate|ail en poudre|piment|sauce soja|édulcorant)\b/i;
export const estBasique = (nom: string) => BASIQUE.test(nomCourt(nom));

export const GROUPES_INGREDIENTS = [
  { code: "fixe", libelle: "Légumes & aromates" },
  { code: "proteine", libelle: "Protéines" },
  { code: "glucide", libelle: "Féculents" },
  { code: "fruit", libelle: "Fruits" },
  { code: "lipide", libelle: "Bonnes graisses" },
] as const;

/** Deux noms d'ingrédient comparés sans accents ni majuscules (« Œuf » = « oeuf »). */
const cleNom = (n: string) => normaliser(n);

export type IngredientACocher = { id: string; nom: string; groupe: (typeof GROUPES_INGREDIENTS)[number]["code"] };

/** Les ingrédients à cocher (ceux des recettes, sans les basiques du placard), par groupe et par nom. */
export function ingredientsACocher(recettes: RecetteMenu[]): IngredientACocher[] {
  const parId = new Map<string, IngredientACocher>();
  for (const r of recettes) {
    for (const i of r.ingredients) {
      if (estBasique(i.aliment.nom) || parId.has(i.aliment_id)) continue;
      parId.set(i.aliment_id, { id: i.aliment_id, nom: nomCourt(i.aliment.nom), groupe: i.role });
    }
  }
  // Un même nom court (deux variantes d'un aliment) : une seule case.
  const parNom = new Map<string, IngredientACocher>();
  for (const i of parId.values()) if (!parNom.has(cleNom(i.nom))) parNom.set(cleNom(i.nom), i);
  const ordre = GROUPES_INGREDIENTS.map((g) => g.code as string);
  return [...parNom.values()].sort((a, b) => ordre.indexOf(a.groupe) - ordre.indexOf(b.groupe) || a.nom.localeCompare(b.nom, "fr"));
}

export type RecetteFaisable = { id: string; titre: string; manquants: string[]; utilises: number };

/**
 * Les recettes faisables avec ce qu'elle a (comparé par nom court : « tomate » couvre toutes les tomates),
 * puis celles où il manque un ou deux ingrédients. Il faut au moins un ingrédient coché dans la recette.
 */
export function avecCeQueJai(recettes: RecetteMenu[], noms: string[], manquantsMax = 2): RecetteFaisable[] {
  const possedes = new Set(noms.map(cleNom));
  if (!possedes.size) return [];
  const resultats: RecetteFaisable[] = [];
  for (const r of recettes) {
    const utiles = r.ingredients.filter((i) => !estBasique(i.aliment.nom));
    if (!utiles.length) continue;
    const noms = [...new Map(utiles.map((i) => [cleNom(nomCourt(i.aliment.nom)), nomCourt(i.aliment.nom)])).values()];
    const manquants = noms.filter((n) => !possedes.has(cleNom(n)));
    const utilises = noms.length - manquants.length;
    if (utilises > 0 && manquants.length <= manquantsMax) resultats.push({ id: r.id, titre: r.titre, manquants, utilises });
  }
  return resultats.sort((a, b) => a.manquants.length - b.manquants.length || b.utilises - a.utilises || a.titre.localeCompare(b.titre, "fr"));
}

/** L'annonce du menu part de 10 h à 20 h, à partir du dimanche qui précède la semaine (jamais deux fois). */
export const HEURES_ANNONCE_MENU = { debut: "10:00", fin: "20:00" } as const;
export function menuAAnnoncer(lundi: string, aujourdhui: string): boolean {
  return aujourdhui >= ajouterJours(lundi, -1) && aujourdhui <= ajouterJours(lundi, 6);
}
