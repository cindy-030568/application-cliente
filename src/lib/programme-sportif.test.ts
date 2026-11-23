import { describe, expect, it } from "vitest";
import {
  CONSIGNE_CLAUDE,
  cleExercice,
  compterExercices,
  dateRenouvellement,
  echeanceRenouvellement,
  datesPlanning,
  extraireProgramme,
  extraireProgrammes,
  statutProgramme,
  lireProgramme,
  rappelRenouvellementDu,
  renouvellementParDefaut,
  semaineProgramme,
  texteModification,
  volume,
} from "./programme-sportif";

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

describe("changement de programme", () => {
  it("date prévue : choisie par la coach, sinon 6 semaines après la publication (jour à Paris)", () => {
    expect(dateRenouvellement({ renouveler_le: "2026-12-20", publie_le: "2026-11-01T10:00:00Z" })).toBe("2026-12-20");
    // 23 h 30 UTC le 1er novembre = 2 novembre à Paris
    expect(dateRenouvellement({ publie_le: "2026-11-01T23:30:00Z" })).toBe("2026-12-14");
    expect(dateRenouvellement({ renouveler_le: null, publie_le: null })).toBeNull();
    expect(renouvellementParDefaut("2026-11-18")).toBe("2026-12-30");
  });
  it("prévient à J-7, J-3, le jour J, puis relance tous les 3 jours pendant 2 semaines", () => {
    const d = "2026-12-30";
    expect(rappelRenouvellementDu(d, "2026-12-22", null)).toBeNull();
    expect(rappelRenouvellementDu(d, "2026-12-23", null)).toBe("bientot");
    expect(rappelRenouvellementDu(d, "2026-12-24", "2026-12-23")).toBeNull();
    // tâche du matin manquée le 23 : le rappel part le 25
    expect(rappelRenouvellementDu(d, "2026-12-25", null)).toBe("bientot");
    expect(rappelRenouvellementDu(d, "2026-12-27", "2026-12-23")).toBe("relance");
    expect(rappelRenouvellementDu(d, "2026-12-28", "2026-12-27")).toBeNull();
    expect(rappelRenouvellementDu(d, "2026-12-30", "2026-12-27")).toBe("jour");
    expect(rappelRenouvellementDu(d, "2027-01-01", "2026-12-30")).toBeNull();
    expect(rappelRenouvellementDu(d, "2027-01-02", "2026-12-30")).toBe("retard");
    expect(rappelRenouvellementDu(d, "2027-01-05", "2027-01-02")).toBe("retard");
    // plusieurs paliers sautés : un seul rappel, le plus récent
    expect(rappelRenouvellementDu(d, "2027-01-02", "2026-12-23")).toBe("retard");
    expect(rappelRenouvellementDu(d, "2027-01-11", "2027-01-08")).toBe("retard");
    // au-delà de 2 semaines de retard : on arrête
    expect(rappelRenouvellementDu(d, "2027-01-20", "2027-01-11")).toBeNull();
  });
  it("reporter la date réarme les rappels", () => {
    expect(rappelRenouvellementDu("2027-01-13", "2027-01-06", "2026-12-30")).toBe("bientot");
  });
  it("semaine en cours", () => {
    expect(semaineProgramme("2026-11-18T09:00:00Z", "2026-12-30", "2026-11-18")).toEqual({ semaine: 1, total: 6 });
    expect(semaineProgramme("2026-11-18T09:00:00Z", "2026-12-30", "2026-12-02")).toEqual({ semaine: 3, total: 6 });
    expect(semaineProgramme("2026-11-18T09:00:00Z", "2026-12-30", "2026-12-31")).toEqual({ semaine: 7, total: 6 });
    expect(semaineProgramme(null, "2026-12-30", "2026-12-02")).toBeNull();
  });
  it("texte pour la coach", () => {
    expect(echeanceRenouvellement("2026-11-18", "2026-11-18").texte).toBe("aujourd’hui");
    expect(echeanceRenouvellement("2026-11-23", "2026-11-18").texte).toBe("dans 5 j");
    expect(echeanceRenouvellement("2026-11-15", "2026-11-18")).toEqual({ texte: "en retard de 3 j", retard: true, jours: -3 });
  });
});

describe("plusieurs programmes et planning", () => {
  const prog = (titre: string) => JSON.stringify({ titre, seances: [{ nom: "S1", blocs: [{ exercices: [{ nom: "Squat" }] }] }] });
  it("lit plusieurs blocs de code, dans l'ordre", () => {
    const r = extraireProgrammes(`Programme 1 :\n\`\`\`json\n${prog("P1")}\n\`\`\`\nProgramme 2 :\n\`\`\`json\n${prog("P2")}\n\`\`\``);
    expect(r.programmes?.map((p) => p.titre)).toEqual(["P1", "P2"]);
  });
  it("lit une liste JSON", () => {
    expect(extraireProgrammes(`[${prog("A")}, ${prog("B")}, ${prog("C")}]`).programmes?.length).toBe(3);
    expect(extraireProgrammes(`{"programmes": [${prog("A")}, ${prog("B")}]}`).programmes?.length).toBe(2);
  });
  it("un seul programme comme avant, et les erreurs", () => {
    expect(extraireProgrammes(`\`\`\`json\n${prog("Seul")}\n\`\`\``).programmes?.[0].titre).toBe("Seul");
    expect(extraireProgrammes(`\`\`\`json\n${prog("A")}\n\`\`\`\n\`\`\`json\n{"titre": "vide"}\n\`\`\``).erreur).toMatch(/^Programme n° 2/);
  });
  it("statut", () => {
    expect(statutProgramme({ publie: true, publie_le: "x" })).toBe("en_ligne");
    expect(statutProgramme({ publie: false, publie_le: "x", debut_le: "2026-12-01" })).toBe("termine");
    expect(statutProgramme({ publie: false, publie_le: null, debut_le: "2026-12-01" })).toBe("planifie");
    expect(statutProgramme({ publie: false, publie_le: null })).toBe("brouillon");
  });
  it("planning toutes les 6 semaines depuis le début du coaching", () => {
    // coaching commencé le 1er octobre, on est le 18 novembre (période 2 : du 12 nov. au 23 déc.)
    expect(datesPlanning("2026-10-01", "2026-11-18", true, 2)).toEqual(["2026-12-24", "2027-02-04"]);
    // aucun programme en ligne : le premier démarre sur la période en cours (tout de suite)
    expect(datesPlanning("2026-10-01", "2026-11-18", false, 2)).toEqual(["2026-11-12", "2026-12-24"]);
    // coaching qui commence plus tard
    expect(datesPlanning("2026-12-07", "2026-11-18", false, 3)).toEqual(["2026-12-07", "2027-01-18", "2027-03-01"]);
    // sans date de début : à partir d'aujourd'hui
    expect(datesPlanning(null, "2026-11-18", true, 1)).toEqual(["2026-12-30"]);
  });
});
