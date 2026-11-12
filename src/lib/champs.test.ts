import { describe, expect, it } from "vitest";
import { avecJours, parSection } from "./champs";

describe("avecJours", () => {
  it("remplace {jours} par le rythme de la cliente", () => {
    expect(avecJours("ces {jours} derniers jours", 14)).toBe("ces 14 derniers jours");
  });
  it("15 jours par défaut, comme la trame", () => {
    expect(avecJours("les {jours} prochains jours", null)).toBe("les 15 prochains jours");
  });
});

describe("parSection", () => {
  it("garde l'ordre des rubriques et des questions", () => {
    const r = parSection([
      { section: "Mes mesures", ordre: 101 },
      { section: "Ressentis & énergie", ordre: 2 },
      { section: "Nutrition & habitudes", ordre: 10 },
      { section: "Ressentis & énergie", ordre: 1 },
    ]);
    expect(r.map((s) => s.section)).toEqual(["Ressentis & énergie", "Nutrition & habitudes", "Mes mesures"]);
    expect(r[0].champs.map((c) => c.ordre)).toEqual([1, 2]);
  });
});
