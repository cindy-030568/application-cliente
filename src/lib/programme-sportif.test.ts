import { describe, expect, it } from "vitest";
import { CONSIGNE_CLAUDE, cleExercice, compterExercices, extraireProgramme, lireProgramme, texteModification, volume } from "./programme-sportif";

const reponse = `Voici le programme validé :

\`\`\`json
{
  "titre": "Tonification 6 semaines",
  "frequence": "3 séances / semaine",
  "seances": [
    {
      "nom": "Séance A",
      "jour": "Lundi",
      "echauffement": "5 min rameur",
      "blocs": [
        { "titre": "Force", "format": "4 séries", "exercices": [
          { "nom": "Deadlift", "series": 4, "repetitions": "6-8", "charge": "60 % 1RM", "repos": "2 min", "tempo": null, "consignes": "Dos neutre" }
        ] },
        { "titre": "Metcon", "format": "EMOM 12 min", "exercices": [
          { "nom": "Burpees", "repetitions": "10" },
          { "nom": "" }
        ] }
      ]
    },
    { "nom": "Séance vide", "blocs": [] }
  ],
  "conseils": "Hydrate-toi."
}
\`\`\`

Dis-moi si tu veux ajuster quelque chose !`;

describe("extraireProgramme", () => {
  it("retrouve le JSON dans la réponse de Claude et le nettoie", () => {
    const r = extraireProgramme(reponse);
    expect(r.erreur).toBeUndefined();
    const p = r.programme!;
    expect(p.titre).toBe("Tonification 6 semaines");
    expect(p.seances).toHaveLength(1); // la séance sans exercice est ignorée
    expect(p.seances[0].blocs[1].exercices).toHaveLength(1); // l'exercice sans nom est ignoré
    expect(p.seances[0].blocs[0].exercices[0].series).toBe("4"); // nombre → texte
    expect(p.seances[0].blocs[1].exercices[0].charge).toBeNull();
    expect(compterExercices(p)).toBe(2);
  });

  it("accepte un JSON collé sans balises, avec des guillemets typographiques", () => {
    const r = extraireProgramme(`{“seances”: [{“nom”: “A”, “exercices”: [{“nom”: “Squat”}]}]}`);
    expect(r.programme?.seances[0].blocs[0].exercices[0].nom).toBe("Squat");
  });

  it("explique le problème quand ce n'est pas un programme", () => {
    expect(extraireProgramme("").erreur).toMatch(/Colle/);
    expect(extraireProgramme("Bonjour, voici quelques idées").erreur).toMatch(/Je ne trouve pas/);
    expect(extraireProgramme('{"seances": [{"nom": "A", "blocs": [').erreur).toMatch(/incomplet/);
    expect(extraireProgramme('{"titre": "x", "seances": []}').erreur).toMatch(/aucune séance/);
  });
});

describe("format", () => {
  it("la consigne contient un exemple valide", () => {
    const r = extraireProgramme(CONSIGNE_CLAUDE);
    expect(r.programme?.seances[0].blocs).toHaveLength(2);
  });

  it("le texte de modification se relit à l'identique", () => {
    const p = extraireProgramme(reponse).programme!;
    expect(extraireProgramme(texteModification(p)).programme).toEqual(p);
    expect(lireProgramme(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it("écrit le volume", () => {
    expect(volume({ series: "4", repetitions: "10" })).toBe("4 × 10");
    expect(volume({ series: null, repetitions: "12 calories" })).toBe("12 calories");
    expect(volume({ series: "3", repetitions: null })).toBe("3 séries");
  });

  it("rapproche les noms d'exercices", () => {
    expect(cleExercice("Fente arrière – haltères")).toBe(cleExercice("fente ARRIERE haltères"));
  });
});
