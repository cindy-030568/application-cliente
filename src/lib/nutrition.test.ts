import { describe, expect, it } from "vitest";
import {
  additionner,
  arrondir,
  bornesParDefaut,
  enGrammes,
  kcalDesMacros,
  macrosDe,
  roleSuggere,
  typeRecettePourRepas,
} from "./nutrition";

const poulet = { proteines_100: 23.4, glucides_100: 0, lipides_100: 1.5, kcal_100: 110, poids_unite_g: null };
const oeuf = { proteines_100: 12.7, glucides_100: 0.27, lipides_100: 9.83, kcal_100: 140, poids_unite_g: 50 };

describe("macros", () => {
  it("120 g de filet de poulet cru", () => {
    const m = macrosDe(poulet, 120);
    expect(arrondir(m.proteines, 1)).toBe(28.1);
    expect(arrondir(m.lipides, 1)).toBe(1.8);
    expect(arrondir(m.kcal)).toBe(132);
  });
  it("2 œufs (50 g pièce)", () => {
    expect(enGrammes(2, "unite", oeuf)).toBe(100);
    expect(arrondir(macrosDe(oeuf, 2, "unite").proteines, 1)).toBe(12.7);
  });
  it("addition de plusieurs ingrédients", () => {
    const t = additionner([macrosDe(poulet, 100), macrosDe(oeuf, 1, "unite")]);
    expect(arrondir(t.proteines, 2)).toBe(29.75);
  });
  it("kcal d'une cible : 4P + 4G + 9L", () => {
    expect(kcalDesMacros(35, 50, 15)).toBe(475);
  });
  it("le goûter utilise les recettes « collation »", () => {
    expect(typeRecettePourRepas("gouter")).toBe("collation");
    expect(typeRecettePourRepas("diner")).toBe("diner");
  });
});


describe("bornesParDefaut", () => {
  it("protéine : de la moitié au double", () => {
    expect(bornesParDefaut("proteine", 120, "g", 5)).toEqual({ min: 60, max: 240 });
  });
  it("huile : peut descendre à 0", () => {
    expect(bornesParDefaut("lipide", 5, "g", 1)).toEqual({ min: 0, max: 13 });
  });
  it("œufs à l'unité", () => {
    expect(bornesParDefaut("proteine", 2, "unite", 1)).toEqual({ min: 1, max: 4 });
  });
  it("fixe : ne bouge pas", () => {
    expect(bornesParDefaut("fixe", 80, "g", 5)).toEqual({ min: 80, max: 80 });
  });
});

describe("roleSuggere", () => {
  it("poulet → protéine, riz → glucide, huile → lipide", () => {
    expect(roleSuggere({ proteines_100: 23.4, glucides_100: 0, lipides_100: 1.5 })).toBe("proteine");
    expect(roleSuggere({ proteines_100: 7, glucides_100: 78, lipides_100: 0.9 })).toBe("glucide");
    expect(roleSuggere({ proteines_100: 0, glucides_100: 0, lipides_100: 100 })).toBe("lipide");
  });
  it("légumes → fixe, fruits → fruit", () => {
    expect(roleSuggere({ proteines_100: 1, glucides_100: 2, lipides_100: 0.3, sous_groupe: "légumes" })).toBe("fixe");
    expect(roleSuggere({ proteines_100: 1, glucides_100: 20, lipides_100: 0.3, sous_groupe: "fruits" })).toBe("fruit");
  });
});
