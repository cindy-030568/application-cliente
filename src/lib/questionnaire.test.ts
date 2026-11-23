import { describe, expect, it } from "vitest";
import { lireQuestionnaire, parSection, type QuestionArrivee } from "./questionnaire";

const q = (id: string, ordre: number, type: QuestionArrivee["type"], extra: Partial<QuestionArrivee> = {}): QuestionArrivee => ({
  id, ordre, section: "S", libelle: `Question ${id}`, aide: null, type, options: [], obligatoire: false, actif: true, ...extra,
});
const QUESTIONS = [
  q("obj", 10, "objectif", { section: "Objectif", options: ["Perdre du gras", "Maintien", "Muscle", "Tonifier"], obligatoire: true }),
  q("txt", 20, "texte_long", { section: "Objectif", obligatoire: true }),
  q("exc", 30, "exclusions", { section: "Alimentation" }),
  q("rep", 40, "choix", { section: "Alimentation", options: ["2", "3", "4"], obligatoire: true }),
  q("hab", 50, "choix_multiple", { section: "Alimentation", options: ["Je grignote", "Je cuisine"] }),
  q("off", 60, "texte", { actif: false, obligatoire: true }),
];
const CATS = [{ id: "c1", nom: "Gluten" }, { id: "c2", nom: "Porc" }];
function formulaire(valeurs: Record<string, string | string[]>) {
  return {
    get: (k: string) => { const v = valeurs[k]; return Array.isArray(v) ? v[0] ?? null : v ?? null; },
    getAll: (k: string) => { const v = valeurs[k]; return Array.isArray(v) ? v : v ? [v] : []; },
  };
}

describe("questionnaire d'arrivée", () => {
  it("lit les réponses, les exclusions et l'objectif", () => {
    const r = lireQuestionnaire(QUESTIONS, formulaire({
      q_obj: "Tonifier", q_txt: "  Retrouver de l'énergie  ", q_exc: ["c1", "inconnue"], q_exc_autres: "champignons", q_rep: "3", q_hab: ["Je cuisine", "pirate"],
    }), CATS);
    expect(r.manquantes).toEqual([]);
    expect(r.objectif).toBe("recompo");
    expect(r.categoriesExclues).toEqual(["c1"]);
    expect(r.reponses).toEqual([
      { question: "Question obj", reponse: "Tonifier" },
      { question: "Question txt", reponse: "Retrouver de l'énergie" },
      { question: "Question exc", reponse: ["Gluten", "Autres : champignons"] },
      { question: "Question rep", reponse: "3" },
      { question: "Question hab", reponse: ["Je cuisine"] },
    ]);
  });
  it("signale les questions obligatoires sans réponse (pas celles désactivées) et refuse un choix inventé", () => {
    const r = lireQuestionnaire(QUESTIONS, formulaire({ q_obj: "Autre chose", q_rep: "12" }), CATS);
    expect(r.manquantes).toEqual(["Question obj", "Question txt", "Question rep"]);
    expect(r.objectif).toBeNull();
  });
  it("range les questions par section, dans l'ordre", () => {
    expect(parSection(QUESTIONS.slice(0, 5)).map((s) => [s.section, s.questions.length])).toEqual([["Objectif", 2], ["Alimentation", 3]]);
  });
});
