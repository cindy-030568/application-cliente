/**
 * Questionnaire d'arrivée (logique pure, testée) : lecture et vérification des réponses,
 * catégories d'aliments à exclure et objectif à pré-remplir dans sa fiche.
 */

export type TypeQuestion = "texte" | "texte_long" | "choix" | "choix_multiple" | "objectif" | "exclusions";
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
};

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
  return { reponses, manquantes, categoriesExclues, objectif };
}
