import { describe, expect, it } from "vitest";
import {
  etatDefi,
  lireFormulaireDefi,
  objectifParDefaut,
  periodeParDefaut,
  semainesDefi,
  texteGroupe,
  texteObjectif,
  textePeriode,
  texteProgression,
  texteReussiteDefi,
} from "./defis";

const decembre = { debut: "2026-12-01", fin: "2026-12-31" };

describe("défis du mois", () => {
  it("écrit la règle du défi", () => {
    expect(texteObjectif({ type: "pas", seuil: 8000, objectif: 20, ...decembre })).toBe("8 000 pas ou plus, au moins 20 jours");
    expect(texteObjectif({ type: "hydratation", seuil: 1.5, objectif: 20, ...decembre })).toBe("1,5 L d’eau ou plus, au moins 20 jours");
    expect(texteObjectif({ type: "sommeil", seuil: 7.5, objectif: 15, ...decembre })).toBe("7 h 30 de sommeil ou plus, au moins 15 nuits");
    expect(texteObjectif({ type: "seances", seuil: 3, objectif: 4, ...decembre })).toBe("3 séances par semaine, 4 semaines de suite");
    expect(texteObjectif({ type: "seances", seuil: 2, objectif: 3, ...decembre })).toBe("2 séances par semaine, au moins 3 semaines sur 4");
    expect(texteObjectif({ type: "journal", seuil: null, objectif: 25, ...decembre })).toBe("Ton journal rempli au moins 25 jours");
  });

  it("écrit la période", () => {
    expect(textePeriode(decembre)).toBe("du 1er au 31 décembre");
    expect(textePeriode({ debut: "2026-11-15", fin: "2026-12-14" })).toBe("du 15 novembre au 14 décembre");
  });

  it("propose le mois en cours au début du mois, sinon le suivant", () => {
    expect(periodeParDefaut("2026-12-03")).toEqual(decembre);
    expect(periodeParDefaut("2026-11-25")).toEqual(decembre);
    expect(periodeParDefaut("2026-12-20")).toEqual({ debut: "2027-01-01", fin: "2027-01-31" });
    expect(periodeParDefaut("2027-01-20")).toEqual({ debut: "2027-02-01", fin: "2027-02-28" });
  });

  it("compte les semaines complètes et propose un objectif", () => {
    expect(semainesDefi(decembre)).toBe(4);
    expect(objectifParDefaut({ type: "seances", ...decembre })).toBe(4);
    expect(objectifParDefaut({ type: "pas", ...decembre })).toBe(21);
  });

  it("situe le défi dans le temps", () => {
    expect(etatDefi(decembre, "2026-11-30")).toBe("a_venir");
    expect(etatDefi(decembre, "2026-12-31")).toBe("en_cours");
    expect(etatDefi(decembre, "2027-01-01")).toBe("termine");
  });

  it("vérifie le formulaire", () => {
    const base = { titre: "Décembre en mouvement", type: "pas", seuil: "8 000", objectif: "20", debut: "2026-12-01", fin: "2026-12-31" };
    expect(lireFormulaireDefi(base).valeurs).toMatchObject({ type: "pas", seuil: 8000, objectif: 20, audience: "toutes" });
    expect(lireFormulaireDefi({ ...base, type: "hydratation", seuil: "1,5" }).valeurs?.seuil).toBe(1.5);
    expect(lireFormulaireDefi({ ...base, type: "journal", seuil: "" }).valeurs?.seuil).toBeNull();
    expect(lireFormulaireDefi({ ...base, objectif: "40" }).erreur).toMatch(/31 jours/);
    expect(lireFormulaireDefi({ ...base, type: "seances", seuil: "3", objectif: "5" }).erreur).toMatch(/4 semaines/);
    expect(lireFormulaireDefi({ ...base, type: "seances", seuil: "2,5", objectif: "4" }).erreur).toMatch(/entier/);
    expect(lireFormulaireDefi({ ...base, fin: "2026-11-01" }).erreur).toMatch(/après/);
    expect(lireFormulaireDefi({ ...base, titre: " " }).erreur).toMatch(/titre/);
    expect(lireFormulaireDefi({ ...base, audience: "communaute" }).valeurs?.audience).toBe("communaute");
  });

  it("montre la progression, sans aucun nombre en mode sans chiffres", () => {
    expect(texteProgression("pas", { reussites: 12, objectif: 20, reussi: false }, false)).toBe("12 jours réussis sur 20");
    expect(texteProgression("seances", { reussites: 1, objectif: 4, reussi: false }, false)).toBe("1 semaine réussie sur 4");
    expect(texteProgression("pas", { reussites: 20, objectif: 20, reussi: true }, false)).toMatch(/relevé/);
    for (const n of [0, 3, 12, 19]) expect(texteProgression("pas", { reussites: n, objectif: 20, reussi: false }, true)).not.toMatch(/\d/);
    expect(texteGroupe({ groupe: 64, participantes: 5 }, false)).toBe("Le groupe en est à 64 % du défi");
    expect(texteGroupe({ groupe: 64, participantes: 5 }, true)).not.toMatch(/\d/);
    expect(texteGroupe({ groupe: null, participantes: 2 }, false)).not.toMatch(/\d/);
    expect(texteReussiteDefi({ titre: "10 000 pas" }, true)).not.toMatch(/\d/);
  });
});
