import { describe, expect, it } from "vitest";
import { nomIngredient } from "./noms-aliments";

describe("nomIngredient", () => {
  it("retire les précisions, garde cru / cuit", () => {
    expect(nomIngredient("Tomate, pulpe, appertisée")).toBe("Tomate");
    expect(nomIngredient("Cumin, graine")).toBe("Cumin");
    expect(nomIngredient("Persil, frais")).toBe("Persil");
    expect(nomIngredient("Avocat, pulpe, cru")).toBe("Avocat cru");
    expect(nomIngredient("Banane, pulpe, crue")).toBe("Banane crue");
    expect(nomIngredient("Crevette grise, cuite")).toBe("Crevette grise cuite");
    expect(nomIngredient("Saumon, cru, élevage")).toBe("Saumon cru");
    expect(nomIngredient("Pâtes sèches standard, crues")).toBe("Pâtes sèches standard crues");
    expect(nomIngredient("Fruits rouges, crus (framboises, fraises, groseilles, cassis)")).toBe("Fruits rouges crus");
    expect(nomIngredient("Jambon cuit, choix, découenné dégraissé")).toBe("Jambon cuit");
    expect(nomIngredient("Sauce soja, préemballée")).toBe("Sauce soja");
    expect(nomIngredient("Origan, séché")).toBe("Origan");
    expect(nomIngredient("Lait demi-écrémé, UHT")).toBe("Lait demi-écrémé");
    expect(nomIngredient("Olive noire (aliment moyen)")).toBe("Olive noire");
    expect(nomIngredient("Lait de coco ou Crème de coco")).toBe("Lait de coco");
    expect(nomIngredient("Beurre de cacahuète ou Pâte d'arachide")).toBe("Beurre de cacahuète");
  });
  it("noms réécrits à la main", () => {
    expect(nomIngredient("Oeuf, blanc (blanc d'oeuf), cru")).toBe("Blanc d'œuf");
    expect(nomIngredient("Oeuf, cru")).toBe("Œuf");
    expect(nomIngredient("Poulet, filet, sans peau, cru")).toBe("Filet de poulet cru");
    expect(nomIngredient("Lentille corail, sèche")).toBe("Lentille corail crue");
  });
  it("laisse les noms simples (aliments perso) tels quels", () => {
    expect(nomIngredient("Skyr nature 0 %")).toBe("Skyr nature 0 %");
    expect(nomIngredient("Miel")).toBe("Miel");
  });
});
