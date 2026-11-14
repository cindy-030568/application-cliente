import { describe, expect, it } from "vitest";
import { nomCourt, quantiteArticle, rayonPour, regrouperCourses, texteCourses, type LigneCourses } from "./courses";

const ligne = (o: Partial<LigneCourses>): LigneCourses => ({
  id: Math.random().toString(36).slice(2),
  aliment_id: null,
  nom: "?",
  rayon: "Divers",
  quantite: null,
  unite: null,
  nom_unite: null,
  coche: false,
  ...o,
});

describe("rayonPour", () => {
  it("range chaque aliment au bon rayon", () => {
    expect(rayonPour("fruits, légumes, légumineuses et oléagineux", "fruits")).toBe("Fruits & légumes");
    expect(rayonPour("fruits, légumes, légumineuses et oléagineux", "légumineuses")).toBe("Épicerie salée");
    expect(rayonPour("viandes, œufs, poissons et assimilés", "œufs")).toBe("Crèmerie & œufs");
    expect(rayonPour("viandes, œufs, poissons et assimilés", "viandes crues")).toBe("Viandes & poissons");
    expect(rayonPour("matières grasses", "beurres")).toBe("Crèmerie & œufs");
    expect(rayonPour("matières grasses", "huiles et graisses végétales")).toBe("Épicerie salée");
    expect(rayonPour("produits sucrés", "céréales de petit-déjeuner")).toBe("Féculents & pain");
    expect(rayonPour(null, null)).toBe("Divers");
    expect(rayonPour("eaux et autres boissons", "boissons sans alcool", [], "Cacao, non sucré, poudre soluble")).toBe("Épicerie sucrée");
  });
  it("sans groupe Ciqual, se sert des catégories d'exclusion", () => {
    expect(rayonPour(null, null, ["Gluten"])).toBe("Féculents & pain");
    expect(rayonPour(null, null, ["Produits laitiers"])).toBe("Crèmerie & œufs");
    expect(rayonPour(null, null, ["Soja"])).toBe("Divers");
  });
});

describe("nomCourt", () => {
  it("garde l'essentiel du nom Ciqual", () => {
    expect(nomCourt("Avocat, pulpe, cru")).toBe("Avocat");
    expect(nomCourt("Poulet, filet, sans peau, cru")).toBe("Filet de poulet");
    expect(nomCourt("Lait demi-écrémé, UHT")).toBe("Lait demi-écrémé");
    expect(nomCourt("Pain complet ou intégral (à la farine T150)")).toBe("Pain complet");
    expect(nomCourt("Persil, frais")).toBe("Persil");
    expect(nomCourt("Tomate, pulpe, appertisée")).toBe("Tomate");
    expect(nomCourt("Fruits rouges, crus (framboises, fraises, groseilles, cassis)")).toBe("Fruits rouges");
    expect(nomCourt("Skyr nature 0 %")).toBe("Skyr nature 0 %");
  });
});

describe("regrouperCourses", () => {
  it("additionne un même aliment venant de plusieurs recettes", () => {
    const s = regrouperCourses([
      ligne({ aliment_id: "poulet", nom: "Poulet", rayon: "Viandes & poissons", quantite: 120, unite: "g" }),
      ligne({ aliment_id: "poulet", nom: "Poulet", rayon: "Viandes & poissons", quantite: 135, unite: "g" }),
      ligne({ aliment_id: "oeuf", nom: "Œuf", rayon: "Crèmerie & œufs", quantite: 2, unite: "unite", nom_unite: "œuf" }),
      ligne({ aliment_id: "oeuf", nom: "Œuf", rayon: "Crèmerie & œufs", quantite: 1, unite: "unite", nom_unite: "œuf" }),
      ligne({ aliment_id: "banane", nom: "Banane", rayon: "Fruits & légumes", quantite: 120, unite: "g" }),
    ]);
    expect(s.map((x) => x.rayon)).toEqual(["Fruits & légumes", "Viandes & poissons", "Crèmerie & œufs"]);
    expect(s[1].articles[0]).toMatchObject({ nom: "Poulet", grammes: 255 });
    expect(quantiteArticle(s[2].articles[0])).toBe("3 œufs");
  });

  it("mélange unités et grammes, et regroupe les articles libres par nom", () => {
    const s = regrouperCourses([
      ligne({ aliment_id: "x", nom: "Œuf", quantite: 2, unite: "unite", nom_unite: "œuf" }),
      ligne({ aliment_id: "x", nom: "Œuf", quantite: 60, unite: "g" }),
      ligne({ nom: "Éponges" }),
      ligne({ nom: "éponges " }),
    ]);
    const art = s[0].articles;
    expect(art).toHaveLength(2);
    expect(quantiteArticle(art.find((a) => a.nom === "Œuf")!)).toBe("2 œufs + 60 g");
    expect(art.find((a) => a.nom === "Éponges")!.ids).toHaveLength(2);
  });

  it("un article n'est coché que si toutes ses lignes le sont, et passe en fin de rayon", () => {
    const s = regrouperCourses([
      ligne({ aliment_id: "a", nom: "Abricot", coche: true }),
      ligne({ aliment_id: "b", nom: "Banane", coche: true }),
      ligne({ aliment_id: "b", nom: "Banane", coche: false }),
    ]);
    expect(s[0].articles.map((a) => [a.nom, a.coche])).toEqual([["Banane", false], ["Abricot", true]]);
  });
});

describe("texteCourses", () => {
  it("liste les articles restants par rayon", () => {
    const t = texteCourses(
      regrouperCourses([
        ligne({ aliment_id: "p", nom: "Poulet", rayon: "Viandes & poissons", quantite: 240, unite: "g" }),
        ligne({ aliment_id: "r", nom: "Riz", rayon: "Féculents & pain", quantite: 60, unite: "g", coche: true }),
        ligne({ nom: "Éponges" }),
      ]),
    );
    expect(t).toBe("Ma liste de courses\n\nVIANDES & POISSONS\n- Poulet : 240 g\n\nDIVERS\n- Éponges");
  });
  it("vide quand tout est coché", () => {
    expect(texteCourses(regrouperCourses([ligne({ nom: "Pain", coche: true })]))).toBe("");
  });
});
