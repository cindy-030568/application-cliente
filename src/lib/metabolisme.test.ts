import { describe, expect, it } from "vitest";
import { besoinsQuotidiens, lireFormulaireMetabolisme, metabolismeDeBase } from "./metabolisme";

describe("mon métabolisme", () => {
  const lea = { annee_naissance: 1990, taille_cm: 165, poids_kg: 64, activite: "moderee" as const };
  it("calcule le métabolisme de base (Mifflin-St Jeor, femme)", () => {
    // 10×64 + 6,25×165 − 5×36 − 161 = 640 + 1031,25 − 180 − 161 = 1330,25
    expect(metabolismeDeBase(lea, 2026)).toBe(1330);
  });
  it("calcule les besoins du quotidien selon l'activité", () => {
    expect(besoinsQuotidiens(lea, 2026)).toBe(2050); // 1330 × 1,55 = 2061,5 → 2050
    expect(besoinsQuotidiens({ ...lea, activite: "sedentaire" }, 2026)).toBe(1600); // 1596 → 1600
  });
  it("vérifie le formulaire", () => {
    expect(lireFormulaireMetabolisme({ annee_naissance: "1990", taille_cm: "165", poids_kg: "64,5", activite: "legere" }, 2026).valeurs).toEqual({
      annee_naissance: 1990,
      taille_cm: 165,
      poids_kg: 64.5,
      activite: "legere",
    });
    expect(lireFormulaireMetabolisme({ annee_naissance: "2015", taille_cm: "165", poids_kg: "64", activite: "legere" }, 2026).erreur).toMatch(/année/);
    expect(lireFormulaireMetabolisme({ annee_naissance: "1990", taille_cm: "1,65", poids_kg: "64", activite: "legere" }, 2026).erreur).toMatch(/centimètres/);
    expect(lireFormulaireMetabolisme({ annee_naissance: "1990", taille_cm: "165", poids_kg: "6", activite: "legere" }, 2026).erreur).toMatch(/kilos/);
    expect(lireFormulaireMetabolisme({ annee_naissance: "1990", taille_cm: "165", poids_kg: "64", activite: "" }, 2026).erreur).toMatch(/activité/);
  });
});
