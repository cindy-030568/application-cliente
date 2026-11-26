import { describe, expect, it } from "vitest";
import { familles } from "./assiette";

describe("méthode de l'assiette", () => {
  it("regroupe les ingrédients par famille, sans calcul", () => {
    const ing = (role: "proteine" | "glucide" | "lipide" | "fruit" | "fixe", nom: string) => ({ role, aliment: { nom } as never });
    const r = familles([ing("proteine", "Poulet"), ing("glucide", "Riz"), ing("fixe", "Courgette"), ing("lipide", "Huile d’olive"), ing("proteine", "Œuf")]);
    expect(r.map((f) => [f.libelle, f.aliments])).toEqual([
      ["Protéines", ["Poulet", "Œuf"]],
      ["Féculents", ["Riz"]],
      ["Bonnes graisses", ["Huile d’olive"]],
    ]);
  });
});
