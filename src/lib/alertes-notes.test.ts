import { describe, expect, it } from "vitest";
import { detecterAlerte } from "./alertes-notes";

describe("notes à lire vite", () => {
  it("douleur ou blessure", () => {
    expect(detecterAlerte("J’ai une douleur au genou depuis la séance de squats")).toBe("douleur");
    expect(detecterAlerte("j'ai mal")).toBe("douleur");
    expect(detecterAlerte("Mal au dos ce matin")).toBe("douleur");
    expect(detecterAlerte("Je me suis blessée en courant")).toBe("douleur");
    expect(detecterAlerte("petite entorse à la cheville")).toBe("douleur");
  });
  it("santé", () => {
    expect(detecterAlerte("J'ai fait un malaise pendant le cardio")).toBe("sante");
    expect(detecterAlerte("Je suis enceinte !")).toBe("sante");
    expect(detecterAlerte("rdv chez le médecin demain")).toBe("sante");
    expect(detecterAlerte("Malade, fièvre depuis hier")).toBe("sante");
    expect(detecterAlerte("je n'ai pas eu mes règles ce mois-ci")).toBe("sante");
  });
  it("moral ou rapport à la nourriture (passe avant le reste)", () => {
    expect(detecterAlerte("Grosse crise de boulimie hier soir, je me déteste")).toBe("moral");
    expect(detecterAlerte("J’en peux plus, envie de tout abandonner")).toBe("moral");
    expect(detecterAlerte("j'ai pleuré toute la soirée")).toBe("moral");
    expect(detecterAlerte("Beaucoup d’angoisse cette semaine et mal au ventre")).toBe("moral");
  });
  it("demande directe", () => {
    expect(detecterAlerte("C'est urgent, peux-tu m'appeler ?")).toBe("demande");
    expect(detecterAlerte("Cindy, est-ce que je peux remplacer le riz par des pâtes ?")).toBe("demande");
    expect(detecterAlerte("J'ai besoin de te parler")).toBe("demande");
  });
  it("négations et phrases sans souci : rien", () => {
    expect(detecterAlerte("Pas de douleur aujourd’hui, super séance !")).toBeNull();
    expect(detecterAlerte("Je n'ai plus mal au dos 🎉")).toBeNull();
    expect(detecterAlerte("Aucune blessure, tout va bien")).toBeNull();
    expect(detecterAlerte("Je ne vais pas abandonner !")).toBeNull();
    expect(detecterAlerte("Pas mal du tout cette journée, j'ai mal dormi mais ça va")).toBeNull();
    expect(detecterAlerte("Bonne journée, repas réussis et 10 000 pas")).toBeNull();
    expect(detecterAlerte("")).toBeNull();
    expect(detecterAlerte(null)).toBeNull();
  });
  it("une négation dans une autre phrase ne compte pas", () => {
    expect(detecterAlerte("Pas de sport aujourd'hui. Douleur à l'épaule.")).toBe("douleur");
  });
});
