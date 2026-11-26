import { describe, expect, it } from "vitest";
import {
  avecCeQueJai,
  estBasique,
  etapesBatch,
  ingredientsACocher,
  jourDuMenu,
  menuAAnnoncer,
  proposerBatch,
  proposerMenu,
  quantitesDuMenu,
  semaineAMontrer,
  type RecetteMenu,
} from "./menus";

const ing = (aliment_id: string, nom: string, role: RecetteMenu["ingredients"][number]["role"], qte_base = 100, unite: "g" | "unite" = "g") => ({
  aliment_id, role, unite, qte_base, aliment: { nom, nom_unite: unite === "unite" ? "œuf" : null },
});
const recette = (id: string, repas: string[], ingredients: RecetteMenu["ingredients"] = []): RecetteMenu => ({ id, titre: `Recette ${id}`, repas, ingredients });

describe("proposerMenu", () => {
  const recettes = [
    ...["p1", "p2", "p3"].map((id) => recette(id, ["petit_dejeuner"])),
    ...["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"].map((id) => recette(id, ["dejeuner", "diner"])),
    recette("c1", ["collation"]),
  ];

  it("remplit les 7 jours de chaque repas, de façon stable pour une même semaine", () => {
    const menu = proposerMenu(recettes, { graine: "2030-01-07" });
    expect(menu).toHaveLength(28);
    expect(proposerMenu(recettes, { graine: "2030-01-07" })).toEqual(menu);
    expect(proposerMenu(recettes, { graine: "2030-01-14" })).not.toEqual(menu);
  });

  it("jamais deux jours de suite la même recette, ni la même au déjeuner et au dîner", () => {
    const menu = proposerMenu(recettes, { graine: "x" });
    const a = (jour: number, repas: string) => menu.find((c) => c.jour === jour && c.repas === repas)?.recette_id;
    for (let j = 1; j <= 7; j++) {
      expect(a(j, "dejeuner")).not.toBe(a(j, "diner"));
      if (j < 7) {
        expect(a(j, "petit_dejeuner")).not.toBe(a(j + 1, "petit_dejeuner"));
        expect(a(j, "diner")).not.toBe(a(j + 1, "diner"));
      }
    }
    // 8 recettes pour 7 déjeuners : aucune répétition.
    expect(new Set(menu.filter((c) => c.repas === "dejeuner").map((c) => c.recette_id)).size).toBe(7);
    // Une seule collation : elle revient chaque jour.
    expect(menu.filter((c) => c.repas === "collation").every((c) => c.recette_id === "c1")).toBe(true);
  });

  it("garde les cases choisies par la coach et évite les recettes des semaines d'avant", () => {
    const garder = [{ jour: 3, repas: "diner" as const, recette_id: "m1" }];
    const menu = proposerMenu(recettes, { graine: "y", garder, recentes: ["m2", "m3"] });
    expect(menu.find((c) => c.jour === 3 && c.repas === "diner")?.recette_id).toBe("m1");
    const dejeuners = menu.filter((c) => c.repas === "dejeuner").map((c) => c.recette_id);
    expect(dejeuners.filter((id) => id === "m2" || id === "m3").length).toBeLessThanOrEqual(1);
  });

  it("sans recette pour un repas, ce repas reste vide", () => {
    expect(proposerMenu([recette("m1", ["dejeuner"])], { graine: "z" }).every((c) => c.repas === "dejeuner")).toBe(true);
  });
});

describe("proposerBatch", () => {
  it("propose les étapes d'après les déjeuners et dîners", () => {
    const r = [
      recette("a", ["dejeuner"], [ing("l1", "Courgette, crue", "fixe"), ing("f1", "Riz basmati, cuit", "glucide"), ing("v1", "Poulet, filet, cru", "proteine"), ing("s1", "Sel blanc", "fixe")]),
      recette("b", ["diner"], [ing("l2", "Lentille verte, cuite", "glucide"), ing("o1", "Oeuf, cru", "proteine", 2, "unite"), ing("j1", "Jambon cuit, supérieur", "proteine")]),
      recette("c", ["petit_dejeuner"], [ing("p1", "Pain complet", "glucide")]),
    ];
    const rayons: Record<string, string> = { l1: "Fruits & légumes", s1: "Épicerie salée" };
    const texte = proposerBatch(r, (id) => rayons[id] ?? "Divers");
    const etapes = etapesBatch(texte);
    expect(etapes[0]).toMatch(/courses/);
    expect(texte).toMatch(/légumes : courgette\./);
    expect(texte).toMatch(/féculents en avance : riz basmati\./);
    expect(texte).toMatch(/légumineuses .*lentille verte/);
    expect(texte).toMatch(/protéines : poulet/);
    expect(texte).toMatch(/œufs durs/);
    expect(texte).not.toMatch(/pain|sel|jambon/i);
    expect(etapes.at(-1)).toMatch(/boîtes/);
  });
});

describe("quantitesDuMenu", () => {
  it("additionne les ingrédients de toutes les cases, multipliés par les portions", () => {
    const r = [recette("a", ["dejeuner"], [ing("f1", "Riz", "glucide", 60), ing("o1", "Oeuf", "proteine", 2, "unite")])];
    const cases = [
      { jour: 1, repas: "dejeuner" as const, recette_id: "a" },
      { jour: 2, repas: "dejeuner" as const, recette_id: "a" },
    ];
    expect(quantitesDuMenu(cases, r, 2)).toEqual([
      { aliment_id: "o1", nom: "Oeuf", unite: "unite", nom_unite: "œuf", quantite: 8 },
      { aliment_id: "f1", nom: "Riz", unite: "g", nom_unite: null, quantite: 240 },
    ]);
  });
});

describe("semaine montrée à l'abonnée", () => {
  it("la semaine en cours ; le dimanche, la suivante si elle est publiée", () => {
    expect(semaineAMontrer("2030-01-09", ["2030-01-07"])).toBe("2030-01-07");
    expect(semaineAMontrer("2030-01-13", ["2030-01-07", "2030-01-14"])).toBe("2030-01-14");
    expect(semaineAMontrer("2030-01-13", ["2030-01-07"])).toBe("2030-01-07");
    expect(semaineAMontrer("2030-01-09", ["2030-01-14"])).toBeNull();
    expect(jourDuMenu("2030-01-07", "2030-01-13")).toBe(7);
    expect(jourDuMenu("2030-01-07", "2030-01-14")).toBeNull();
  });
});

describe("Avec ce que j'ai", () => {
  const recettes = [
    recette("omelette", ["diner"], [ing("o", "Oeuf, cru", "proteine"), ing("t", "Tomate, crue", "fixe"), ing("s", "Sel blanc", "fixe"), ing("h", "Huile d'olive", "lipide")]),
    recette("bowl", ["dejeuner"], [ing("r", "Riz basmati, cuit", "glucide"), ing("p", "Poulet, filet", "proteine"), ing("t2", "Tomate cerise, crue", "fixe"), ing("a", "Avocat, pulpe, cru", "lipide")]),
    recette("gateau", ["collation"], [ing("f", "Farine de blé", "glucide"), ing("c", "Chocolat noir", "lipide"), ing("b", "Beurre", "lipide"), ing("su", "Sucre", "glucide")]),
  ];

  it("les basiques du placard ne comptent jamais", () => {
    expect(estBasique("Sel blanc")).toBe(true);
    expect(estBasique("Huile d'olive")).toBe(true);
    expect(estBasique("Tomate, crue")).toBe(false);
    expect(ingredientsACocher(recettes).map((i) => i.nom)).not.toContain("Sel blanc");
  });

  it("faisables d'abord, puis celles où il manque un ou deux ingrédients", () => {
    const noms = ["Oeuf", "Tomate"];
    const r = avecCeQueJai(recettes, noms);
    expect(r[0]).toMatchObject({ id: "omelette", manquants: [] });
    expect(r.map((x) => x.id)).not.toContain("gateau");
    expect(avecCeQueJai(recettes, [])).toEqual([]);
  });
});

describe("annonce du menu", () => {
  it("à partir du dimanche d'avant, et pendant la semaine si elle a été publiée tard", () => {
    expect(menuAAnnoncer("2030-01-07", "2030-01-05")).toBe(false);
    expect(menuAAnnoncer("2030-01-07", "2030-01-06")).toBe(true);
    expect(menuAAnnoncer("2030-01-07", "2030-01-10")).toBe(true);
    expect(menuAAnnoncer("2030-01-07", "2030-01-14")).toBe(false);
  });
});
