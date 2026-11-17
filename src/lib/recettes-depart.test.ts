import { describe, expect, it } from "vitest";
import { detailDepart, resumerDepart, type RecetteDepartResume } from "./recettes-depart";

const depart: RecetteDepartResume[] = [
  { titre: "Porridge", repas: ["petit_dejeuner", "collation"], tags: ["Végétarien"], photo: "porridge.webp" },
  { titre: "Bowl poulet", anciens_titres: ["Bol poulet"], repas: ["dejeuner"], tags: [], photo: "bowl-poulet.webp" },
  { titre: "Curry", repas: ["diner"], tags: ["Végétarien"], photo: "curry.webp" },
  { titre: "Muffins", repas: ["collation"], tags: [], photo: null },
];

describe("resumerDepart", () => {
  it("compte par repas principal, les végétariennes et les manquantes", () => {
    const r = resumerDepart(depart, []);
    expect(r.total).toBe(4);
    expect(r.parRepas).toEqual({ petit_dejeuner: 1, dejeuner: 1, diner: 1, collation: 1 });
    expect(r.vegetariennes).toBe(2);
    expect(r.manquantes).toBe(4);
    expect(r.photosAMettreAJour).toBe(0);
  });

  it("reconnaît un ancien titre et compte les photos à mettre à jour", () => {
    const r = resumerDepart(depart, [
      { titre: "Porridge", photo_path: "depart/porridge.webp" }, // à jour
      { titre: "Bol poulet", photo_path: null }, // photo fournie pas encore installée
      { titre: "Curry", photo_path: "abc/ma-photo.jpg" }, // photo de la coach : on n'y touche pas
      { titre: "Muffins", photo_path: null }, // pas de photo fournie
    ]);
    expect(r.manquantes).toBe(0);
    expect(r.photosAMettreAJour).toBe(1);
  });
});

describe("detailDepart", () => {
  it("accorde au singulier et au pluriel", () => {
    expect(detailDepart(resumerDepart(depart, []))).toBe("1 petit-déjeuner, 1 déjeuner, 1 dîner et 1 collation, dont 2 végétariennes");
  });
});
