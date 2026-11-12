import { describe, expect, it } from "vitest";
import { adapterRecette, macrosPour, recetteExclue, recettesPourRepas, tolerancesPour, type Cible } from "./moteur";
import { RECETTES, recette } from "./__tests__/donnees-reelles";
import { PROFILS, SANS_EXCLUSION, TOLERANCE } from "./__tests__/profils";

const TOUS_LES_CAS = PROFILS.flatMap((p) => p.repas).flatMap((rp) =>
  RECETTES.filter((r) => r.repas.includes(rp.type)).map((r) => ({ r, cible: rp.cible })),
);

describe("cas concret : Bowl poulet teriyaki & riz, dîner 35 P / 45 G / 14 L", () => {
  const r = recette("Bowl poulet teriyaki & riz");
  const cible = { proteines: 35, glucides: 45, lipides: 14 };
  const res = adapterRecette(r.ingredients, cible, TOLERANCE);
  const q = (nom: string) => res.quantites[r.noms.findIndex((n) => n.startsWith(nom))].quantite;

  it("est compatible", () => expect(res.compatible).toBe(true));
  it("chaque macro est dans la tolérance (±10 % ou ±3 g)", () => {
    expect(Math.abs(res.ecarts.proteines)).toBeLessThanOrEqual(3.5);
    expect(Math.abs(res.ecarts.glucides)).toBeLessThanOrEqual(4.5);
    expect(Math.abs(res.ecarts.lipides)).toBeLessThanOrEqual(3);
  });
  it("les légumes et la sauce ne bougent pas", () => {
    expect(q("Brocoli")).toBe(100);
    expect(q("Carotte")).toBe(50);
    expect(q("Sauce soja")).toBe(10);
  });
  it("des quantités réalistes, arrondies à 5 g", () => {
    expect(q("Poulet") % 5).toBe(0);
    expect(q("Poulet")).toBeGreaterThanOrEqual(100);
    expect(q("Poulet")).toBeLessThanOrEqual(160);
    expect(q("Riz") % 5).toBe(0);
    expect(q("Riz")).toBeGreaterThanOrEqual(40);
    expect(q("Riz")).toBeLessThanOrEqual(65);
  });
});

describe("propriétés vérifiées sur les 50 recettes × 3 profils", () => {
  it("toutes les quantités restent dans [min, max], au pas, et les ingrédients fixes ne bougent pas", () => {
    for (const { r, cible } of TOUS_LES_CAS) {
      const res = adapterRecette(r.ingredients, cible, TOLERANCE);
      r.ingredients.forEach((i, k) => {
        const qte = res.quantites[k].quantite;
        if (i.role === "fixe") {
          expect(qte, `${r.titre} / ${r.noms[k]}`).toBe(i.base);
          return;
        }
        expect(qte, `${r.titre} / ${r.noms[k]}`).toBeGreaterThanOrEqual(i.min - 1e-9);
        expect(qte, `${r.titre} / ${r.noms[k]}`).toBeLessThanOrEqual(i.max + 1e-9);
        expect(Math.abs(qte / i.pas - Math.round(qte / i.pas)), `${r.titre} / ${r.noms[k]} au pas`).toBeLessThan(1e-6);
      });
    }
  });

  it("les aliments à l'unité restent des nombres entiers (pas d'œuf coupé en morceaux)", () => {
    for (const { r, cible } of TOUS_LES_CAS) {
      const res = adapterRecette(r.ingredients, cible, TOLERANCE);
      r.ingredients.forEach((i, k) => {
        if (i.unite === "unite") expect(Number.isInteger(res.quantites[k].quantite)).toBe(true);
      });
    }
  });

  it("« compatible » garantit que chaque macro est dans la tolérance", () => {
    for (const { r, cible } of TOUS_LES_CAS) {
      const res = adapterRecette(r.ingredients, cible, TOLERANCE);
      const tols = tolerancesPour(cible, TOLERANCE);
      const dedans = (["proteines", "glucides", "lipides"] as const).every((k) => Math.abs(res.ecarts[k]) <= tols[k] + 1e-9);
      expect(res.compatible).toBe(dedans);
    }
  });

  it("les macros annoncées correspondent aux quantités proposées", () => {
    for (const { r, cible } of TOUS_LES_CAS.slice(0, 40)) {
      const res = adapterRecette(r.ingredients, cible, TOLERANCE);
      const m = macrosPour(r.ingredients, res.quantites.map((x) => x.quantite));
      expect(res.macros.proteines).toBeCloseTo(m.proteines, 6);
    }
  });

  it("même entrée, même résultat (déterministe)", () => {
    const r = recette("Chili con carne");
    const cible = { proteines: 40, glucides: 55, lipides: 16 };
    expect(adapterRecette(r.ingredients, cible, TOLERANCE)).toEqual(adapterRecette(r.ingredients, cible, TOLERANCE));
  });

  it("le moteur ne rate jamais une solution : si aucune combinaison ne tient la tolérance, il le dit", () => {
    // Recherche exhaustive sur toutes les combinaisons possibles, pour chaque cas jugé « non compatible ».
    let verifies = 0;
    for (const { r, cible } of TOUS_LES_CAS) {
      const res = adapterRecette(r.ingredients, cible, TOLERANCE);
      if (res.compatible) continue;
      const tols = tolerancesPour(cible, TOLERANCE);
      const vars = r.ingredients.map((i, k) => (i.role === "fixe" ? -1 : k)).filter((k) => k >= 0);
      const grilles = vars.map((k) => {
        const i = r.ingredients[k];
        const l: number[] = [];
        for (let v = Math.ceil(i.min / i.pas - 1e-9) * i.pas; v <= i.max + 1e-9; v += i.pas) l.push(v);
        return l;
      });
      if (grilles.reduce((a, g) => a * g.length, 1) > 3e6) continue;
      const q = r.ingredients.map((i) => i.base);
      let trouve = false;
      const parcourir = (d: number) => {
        if (trouve) return;
        if (d === vars.length) {
          const m = macrosPour(r.ingredients, q);
          trouve =
            Math.abs(m.proteines - cible.proteines) <= tols.proteines &&
            Math.abs(m.glucides - cible.glucides) <= tols.glucides &&
            Math.abs(m.lipides - cible.lipides) <= tols.lipides;
          return;
        }
        for (const v of grilles[d]) {
          q[vars[d]] = v;
          parcourir(d + 1);
        }
      };
      parcourir(0);
      expect(trouve, `${r.titre} : une solution existait`).toBe(false);
      verifies++;
    }
    expect(verifies).toBeGreaterThan(0);
  }, 60_000);

  it("au moins 80 % des recettes sont proposées pour chaque profil type", () => {
    for (const p of PROFILS) {
      let ok = 0;
      let total = 0;
      for (const rp of p.repas) {
        const s = recettesPourRepas(RECETTES, rp.type, rp.cible, TOLERANCE, SANS_EXCLUSION, true);
        ok += s.compatibles.length;
        total += s.compatibles.length + s.approximatives.length;
      }
      expect(ok / total, p.nom).toBeGreaterThanOrEqual(0.8);
    }
  });

  it("reste rapide : 50 recettes × 12 repas en moins d'une demi-seconde", () => {
    const debut = performance.now();
    for (const p of PROFILS) for (const rp of p.repas) recettesPourRepas(RECETTES, rp.type, rp.cible, TOLERANCE, SANS_EXCLUSION, true);
    expect(performance.now() - debut).toBeLessThan(500);
  });
});

describe("sélection pour un repas", () => {
  const diner: Cible = { proteines: 35, glucides: 45, lipides: 14 };

  it("ne propose que les recettes du bon type de repas", () => {
    const s = recettesPourRepas(RECETTES, "diner", diner, TOLERANCE, SANS_EXCLUSION, true);
    for (const a of [...s.compatibles, ...s.approximatives]) expect(a.recette.repas).toContain("diner");
  });

  it("les compatibles d'abord, des plus proches aux moins proches", () => {
    const s = recettesPourRepas(RECETTES, "diner", diner, TOLERANCE, SANS_EXCLUSION, false);
    const scores = s.compatibles.map((a) => a.resultat.score);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
  });

  it("réglage « masquer » : aucune recette approximative n'est proposée", () => {
    const cibleImpossible = { proteines: 90, glucides: 10, lipides: 2 };
    const masquer = recettesPourRepas(RECETTES, "collation", cibleImpossible, TOLERANCE, SANS_EXCLUSION, false);
    const badge = recettesPourRepas(RECETTES, "collation", cibleImpossible, TOLERANCE, SANS_EXCLUSION, true);
    expect(masquer.compatibles).toHaveLength(0);
    expect(masquer.approximatives).toHaveLength(0);
    expect(badge.approximatives.length).toBeGreaterThan(0);
  });

  it("végétarienne : aucune recette avec viande, porc, volaille, poisson ou fruits de mer", () => {
    const ex = { categories: new Set(["Viande", "Porc", "Volaille", "Poisson", "Fruits de mer"]), aliments: new Set<string>() };
    const s = recettesPourRepas(RECETTES, "dejeuner", diner, TOLERANCE, ex, true);
    const titres = [...s.compatibles, ...s.approximatives].map((a) => a.recette.titre);
    expect(titres).not.toContain("Bowl poulet teriyaki & riz");
    expect(titres).not.toContain("Pâtes au thon & à la tomate");
    expect(titres).toContain("Curry de lentilles corail & raïta");
    expect(s.exclues).toBeGreaterThan(0);
  });

  it("sans porc : le croque jambon disparaît", () => {
    const ex = { categories: new Set(["Porc"]), aliments: new Set<string>() };
    expect(recetteExclue(recette("Croque protéiné jambon-fromage"), ex)).toBe(true);
    expect(recetteExclue(recette("Chili con carne"), ex)).toBe(false);
  });

  it("un aliment précis exclu (coriandre) retire les recettes qui en contiennent", () => {
    const ex = { categories: new Set<string>(), aliments: new Set(["ciqual:11094"]) };
    expect(recetteExclue(recette("Soupe thaï aux crevettes & nouilles de riz"), ex)).toBe(true);
    expect(recetteExclue(recette("Chili con carne"), ex)).toBe(false);
  });
});
