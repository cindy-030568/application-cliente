/**
 * Questionnaire d'arrivée (logique pure, testée) : lecture et vérification des réponses,
 * catégories d'aliments à exclure et objectif à pré-remplir dans sa fiche.
 */

export type TypeQuestion = "texte" | "texte_long" | "choix" | "choix_multiple" | "objectif" | "exclusions" | "nombre" | "date" | "aliments";
export type CibleQuestion = "taille_cm" | "poids_kg" | "date_naissance";
export type QuestionArrivee = {
  id: string;
  ordre: number;
  section: string;
  libelle: string;
  aide: string | null;
  type: TypeQuestion;
  options: string[];
  obligatoire: boolean;
  actif: boolean;
  /** Champ de ses besoins pré-rempli par la réponse (taille, poids, date de naissance). */
  cible?: CibleQuestion | null;
  /** « sport » : posée seulement aux clientes avec suivi sportif. */
  condition?: "sport" | null;
};
export type ReponseArrivee = { question: string; reponse: string | string[] };

/** L'ordre des 4 réponses d'une question « objectif » correspond à ces objectifs de la fiche. */
export const CODES_OBJECTIF = ["perte", "maintien", "prise", "recompo"] as const;
export const TYPES_QUESTION: Record<TypeQuestion, string> = {
  texte: "Réponse courte",
  texte_long: "Réponse longue",
  choix: "Un seul choix",
  choix_multiple: "Plusieurs choix",
  objectif: "Objectif (rempli dans sa fiche)",
  exclusions: "Aliments à exclure (remplis dans sa fiche)",
  nombre: "Nombre",
  date: "Date",
  aliments: "Liste d’aliments déjà cochés (elle décoche, elle ajoute)",
};
export const CIBLES: Record<CibleQuestion, string> = {
  taille_cm: "Sa taille (cm)",
  poids_kg: "Son poids (kg)",
  date_naissance: "Sa date de naissance",
};
const BORNES: Record<"taille_cm" | "poids_kg", [number, number]> = { taille_cm: [100, 230], poids_kg: [25, 350] };

/** Questions à poser à cette cliente (celles du suivi sportif seulement si elle l'a). */
export function questionsPourCliente(questions: QuestionArrivee[], suiviSport: boolean): QuestionArrivee[] {
  return questions.filter((q) => q.actif && (q.condition !== "sport" || suiviSport));
}

/** Sections dans l'ordre des questions. */
export function parSection(questions: QuestionArrivee[]): { section: string; questions: QuestionArrivee[] }[] {
  const sections: { section: string; questions: QuestionArrivee[] }[] = [];
  for (const q of [...questions].sort((a, b) => a.ordre - b.ordre)) {
    const derniere = sections.at(-1);
    if (derniere && derniere.section === q.section) derniere.questions.push(q);
    else sections.push({ section: q.section, questions: [q] });
  }
  return sections;
}

type Lecteur = { get: (cle: string) => string | null; getAll: (cle: string) => string[] };

/** Lit le formulaire : réponses (avec la question recopiée), catégories à exclure, objectif, et questions obligatoires sans réponse. */
export function lireQuestionnaire(questions: QuestionArrivee[], f: Lecteur, categories: { id: string; nom: string }[]) {
  const reponses: ReponseArrivee[] = [];
  const manquantes: string[] = [];
  let categoriesExclues: string[] = [];
  let objectif: (typeof CODES_OBJECTIF)[number] | null = null;
  const besoins: Partial<Record<CibleQuestion, string>> = {};
  const invalides: string[] = [];
  for (const q of questions.filter((x) => x.actif).sort((a, b) => a.ordre - b.ordre)) {
    const cle = `q_${q.id}`;
    let reponse: string | string[] = "";
    if (q.type === "texte" || q.type === "texte_long") {
      reponse = (f.get(cle) ?? "").trim().slice(0, q.type === "texte" ? 300 : 2000);
    } else if (q.type === "choix") {
      const v = f.get(cle) ?? "";
      reponse = q.options.includes(v) ? v : "";
    } else if (q.type === "objectif") {
      const v = f.get(cle) ?? "";
      const i = q.options.indexOf(v);
      if (i >= 0) {
        reponse = v;
        objectif = CODES_OBJECTIF[i] ?? null;
      }
    } else if (q.type === "choix_multiple") {
      reponse = f.getAll(cle).filter((v) => q.options.includes(v));
    } else if (q.type === "nombre") {
      const brut = (f.get(cle) ?? "").trim().replace(",", ".").replace(/\s|cm|kg/gi, "");
      if (brut) {
        const n = Number(brut);
        const [min, max] = q.cible && q.cible !== "date_naissance" ? BORNES[q.cible] : [0, 100000];
        if (!Number.isFinite(n) || n < min || n > max) invalides.push(q.libelle);
        else {
          reponse = String(n).replace(".", ",");
          if (q.cible && q.cible !== "date_naissance") besoins[q.cible] = String(n);
        }
      }
    } else if (q.type === "date") {
      const v = f.get(cle) ?? "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        reponse = v.split("-").reverse().join("/");
        if (q.cible === "date_naissance") besoins.date_naissance = v;
      }
    } else if (q.type === "aliments") {
      const gardes = f.getAll(cle).filter((v) => q.options.includes(v));
      const retires = q.options.filter((o) => !gardes.includes(o));
      const ajouts = (f.get(`${cle}_ajouts`) ?? "").trim().slice(0, 500);
      reponse = [
        ...(gardes.length ? [`Garde : ${gardes.join(", ")}`] : []),
        ...(retires.length ? [`Retire : ${retires.join(", ")}`] : []),
        ...(ajouts ? [`Ajoute : ${ajouts}`] : []),
      ];
    } else if (q.type === "exclusions") {
      const ids = f.getAll(cle).filter((id) => categories.some((c) => c.id === id));
      categoriesExclues = [...new Set([...categoriesExclues, ...ids])];
      const autres = (f.get(`${cle}_autres`) ?? "").trim().slice(0, 500);
      reponse = [...ids.map((id) => categories.find((c) => c.id === id)!.nom), ...(autres ? [`Autres : ${autres}`] : [])];
    }
    const vide = Array.isArray(reponse) ? reponse.length === 0 : reponse === "";
    if (vide && q.obligatoire) manquantes.push(q.libelle);
    if (!vide) reponses.push({ question: q.libelle, reponse });
  }
  return { reponses, manquantes, invalides, categoriesExclues, objectif, besoins };
}
