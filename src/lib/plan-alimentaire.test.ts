import { describe, expect, it } from "vitest";
import {
  ageEn,
  apportsPlan,
  arrondiGrammes,
  grammesMacros,
  libelleActivite,
  lireContenu,
  metabolismeBase,
  quantiteEquivalente,
  recalculerLigne,
  reequilibrer,
  texteChoix,
  type AlimentPlan,
  type Choix,
} from "./plan-alimentaire";

const avocat: AlimentPlan = { id: "a", nom: "Avocat, pulpe, cru", p: 1.6, g: 1.6, l: 20.6, k: 205, f: 6.7, nom_unite: null, poids_unite_g: null };
const cajou: AlimentPlan = { id: "c", nom: "Noix de cajou, grillée", p: 21.7, g: 22.3, l: 47.1, k: 597, f: 3.6, nom_unite: null, poids_unite_g: null };
const oeuf: AlimentPlan = { id: "o", nom: "Œuf, cru", p: 12.7, g: 0.3, l: 9.8, k: 140, f: null, nom_unite: "œuf", poids_unite_g: 55 };
const poulet: AlimentPlan = { id: "p", nom: "Poulet, filet, cru", p: 23, g: 0, l: 1.5, k: 112, f: 0, nom_unite: null, poids_unite_g: null };
const ch = (aliment: AlimentPlan, quantite: number, unite: Choix["unite"] = "g"): Choix => ({ aliment, quantite, unite });

describe("besoins", () => {
  it("calcule l'âge à une date donnée", () => {
    expect(ageEn("1986-11-26", "2026-11-25")).toBe(39);
    expect(ageEn("1986-11-26", "2026-11-26")).toBe(40);
  });

  it("métabolisme de base selon la formule", () => {
    expect(metabolismeBase({ formule: "mifflin", sexe: "femme", poids: 60, taille: 165, age: 30 })).toBeCloseTo(1320.25, 1);
    expect(metabolismeBase({ formule: "harris", sexe: "femme", poids: 60, taille: 165, age: 30 })).toBeCloseTo(1383.7, 0);
    // Formule de Black : proche des valeurs affichées par Nutrium (77,9 kg, 1,73 m, 39 ans → ~1522 kcal).
    expect(metabolismeBase({ formule: "black", sexe: "femme", poids: 77.9, taille: 173, age: 39 })).toBeCloseTo(1520, -1);
    expect(metabolismeBase({ formule: "black", sexe: "femme", poids: 0, taille: 173, age: 39 })).toBeNull();
  });

  it("répartit les calories en grammes (exemple 1850 kcal, 37/30/33 %)", () => {
    const g = grammesMacros(1850, { lipides: 37, glucides: 30, proteines: 33 });
    expect(Math.round(g.lipides)).toBe(76);
    expect(Math.round(g.glucides)).toBe(139);
    expect(Math.round(g.proteines)).toBe(153);
  });

  it("garde 100 % quand on bouge un curseur", () => {
    const r = reequilibrer({ lipides: 35, glucides: 40, proteines: 25 }, "proteines", 33);
    expect(r.proteines).toBe(33);
    expect(r.lipides + r.glucides + r.proteines).toBe(100);
    expect(r.lipides).toBeLessThan(r.glucides);
  });

  it("nomme le niveau d'activité", () => {
    expect(libelleActivite(1.4)).toBe("Sédentaire");
    expect(libelleActivite(1.75)).toBe("Actif");
    expect(libelleActivite(2.2)).toBe("Personnalisé");
  });
});

describe("équivalences", () => {
  it("40 g d'avocat ≈ 15 g de noix de cajou (calories)", () => {
    expect(quantiteEquivalente(ch(avocat, 40), cajou, "kcal")).toBe(15);
  });

  it("équivalence en protéines, et en unités", () => {
    expect(quantiteEquivalente(ch(oeuf, 3, "unite"), poulet, "proteines")).toBe(90);
    expect(quantiteEquivalente(ch(poulet, 100), oeuf, "proteines", "unite")).toBe(3.5);
  });

  it("se rabat sur les calories si l'aliment n'a pas la macro", () => {
    expect(quantiteEquivalente(ch(poulet, 100), avocat, "glucides")).toBe(55);
  });

  it("arrondit lisiblement", () => {
    expect(arrondiGrammes(7.4)).toBe(7);
    expect(arrondiGrammes(43)).toBe(45);
    expect(arrondiGrammes(236)).toBe(240);
    expect(arrondiGrammes(0.2)).toBe(1);
  });

  it("recalcule les alternatives sauf celles corrigées à la main", () => {
    const l = recalculerLigne({
      principal: ch(avocat, 80),
      alternatives: [ch(cajou, 15), { ...ch(cajou, 99), manuel: true }],
      base: "kcal",
    });
    expect(l.alternatives[0].quantite).toBe(25);
    expect(l.alternatives[1].quantite).toBe(99);
  });
});

describe("totaux et lecture", () => {
  const contenu = lireContenu({
    repas: [
      { libelle: "Petit-déjeuner", heure: "07:00", note: "", lignes: [{ principal: ch(oeuf, 2, "unite"), alternatives: [ch(poulet, 80)], base: "proteines" }] },
      { libelle: "Déjeuner", heure: "25:00", lignes: [{ principal: ch(avocat, 50), alternatives: [] }, { principal: { aliment: { id: "x" } } }] },
    ],
    objectifs: { kcal: 1850, proteines: 153, glucides: 139, lipides: 76 },
  });

  it("nettoie le contenu (heure invalide, ligne incomplète)", () => {
    expect(contenu.repas).toHaveLength(2);
    expect(contenu.repas[1].heure).toBeNull();
    expect(contenu.repas[1].lignes).toHaveLength(1);
    expect(contenu.repas[1].lignes[0].base).toBe("kcal");
    expect(contenu.objectifs?.fibres).toBeNull();
  });

  it("additionne les aliments principaux seulement", () => {
    const t = apportsPlan(contenu);
    expect(t.kcal).toBeCloseTo(2 * 55 * 1.4 + 50 * 2.05, 5);
    expect(t.fibresIncompletes).toBe(true);
  });

  it("écrit une ligne lisible", () => {
    expect(texteChoix(ch(oeuf, 3, "unite"))).toBe("3 œufs · Œuf, cru");
    expect(texteChoix(ch(cajou, 15))).toBe("15 g · Noix de cajou, grillée");
    expect(texteChoix(ch({ ...oeuf, nom: "Œuf" }, 2, "unite"))).toBe("2 œufs");
  });

  it("refuse une unité pour un aliment sans poids unitaire", () => {
    const c = lireContenu({ repas: [{ lignes: [{ principal: ch(cajou, 2, "unite"), alternatives: [] }] }] });
    expect(c.repas[0].lignes[0].principal.unite).toBe("g");
    expect(c.repas[0].libelle).toBe("Repas");
  });
});
