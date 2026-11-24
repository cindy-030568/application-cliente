import { describe, expect, it } from "vitest";
import { ajouterJours } from "./bilan";
import { analyserCliente, fusionnerPoints, paliersProgressifs, tendance, type DonneesAnalyse, type Point } from "./analyse-cliente";

const AUJ = "2026-11-23";
const base: DonneesAnalyse = {
  aujourdhui: AUJ,
  base: "/coach/clientes/c1",
  debutCoaching: "2026-08-01",
  finCoaching: null,
  joursSansConnexion: 1,
  bilansManques: 0,
  objectif: "perte",
  poidsObjectif: 62,
  poidsBesoins: 70,
  metabolismeBase: 1400,
  depense: 1960,
  kcalActuelles: null,
  kcalObjectif: 1650,
  plan: { depuis: "2026-10-20", kcal: 1650, proteines: 120 },
  poids: [],
  tourTaille: [],
  ressentis: [],
  journal: [],
  programme: null,
  seancesFaites: [],
  charges: [],
};
/** Une pesée par semaine sur `semaines` semaines, finissant aujourd'hui. */
const pesees = (depart: number, parSemaine: number, semaines: number): Point[] =>
  Array.from({ length: semaines + 1 }, (_, i) => ({ date: ajouterJours(AUJ, -7 * (semaines - i)), valeur: depart + parSemaine * i }));
const ids = (d: Partial<DonneesAnalyse>) => analyserCliente({ ...base, ...d }).conseils.map((c) => c.id);

describe("outils", () => {
  it("tendance par moindres carrés", () => {
    const t = tendance(pesees(70, -0.5, 4), AUJ, 28);
    expect(t?.parSemaine).toBeCloseTo(-0.5);
    expect(tendance(pesees(70, -0.5, 1), AUJ, 28)).toBeNull(); // trop peu de points
  });
  it("fusionne bilans et journal, un point par jour", () => {
    expect(fusionnerPoints([{ date: "2026-11-01", valeur: 70 }], [{ date: "2026-11-01", valeur: 69.8 }, { date: "2026-10-25", valeur: 70.4 }])).toEqual([
      { date: "2026-10-25", valeur: 70.4 },
      { date: "2026-11-01", valeur: 69.8 },
    ]);
  });
  it("paliers de +100 kcal par semaine", () => {
    expect(paliersProgressifs(1200, 1650)).toEqual([
      { semaine: 1, kcal: 1300 },
      { semaine: 2, kcal: 1400 },
      { semaine: 3, kcal: 1500 },
      { semaine: 4, kcal: 1600 },
      { semaine: 5, kcal: 1650 },
    ]);
  });
});

describe("poids et mesures", () => {
  it("stagnation : vérifier puis baisser de ~5 %, pause après un long déficit", () => {
    const a = analyserCliente({ ...base, poids: pesees(68, 0, 4) });
    const s = a.conseils.find((c) => c.id === "stagnation")!;
    expect(s.niveau).toBe("important");
    expect(s.actions.join(" ")).toMatch(/1\s550 kcal/); // 1650 × 0,94 arrondi à 50
    expect(s.actions.join(" ")).toMatch(/diet break/); // coaching depuis plus de 12 semaines
  });
  it("poids stable mais taille en baisse : recomposition, ne rien couper", () => {
    const r = ids({ poids: pesees(68, 0, 4), tourTaille: pesees(80, -0.6, 4) });
    expect(r).toContain("recompo");
    expect(r).not.toContain("stagnation");
  });
  it("perte trop rapide", () => {
    const a = analyserCliente({ ...base, poids: pesees(70, -1.2, 4) });
    expect(a.conseils.find((c) => c.id === "perte-rapide")?.niveau).toBe("important");
    expect(a.indicateurs.rythme?.pctSemaine).toBeLessThan(-1.5);
  });
  it("belle progression et bravo depuis le début", () => {
    const r = ids({ poids: pesees(72, -0.5, 6) });
    expect(r).toEqual(expect.arrayContaining(["progression", "bravo-poids"]));
  });
  it("prise de masse qui ne monte pas", () => {
    expect(ids({ objectif: "prise", poidsObjectif: 60, poids: pesees(55, 0, 4) })).toContain("prise-stagne");
  });
  it("pas assez de pesées", () => {
    expect(ids({ poids: [] })).toContain("peu-de-pesees");
  });
});

describe("nutrition", () => {
  it("sous-alimentation : plan de départ progressif jusqu'à la maintenance", () => {
    const a = analyserCliente({ ...base, kcalActuelles: 1100, kcalObjectif: null });
    expect(a.conseils[0].id).toBe("sous-alimentation");
    expect(a.paliers?.[0]).toEqual({ semaine: 1, kcal: 1200 });
    expect(a.paliers?.at(-1)?.kcal).toBe(1950);
  });
  it("objectif sous le métabolisme de base, ou déficit trop fort", () => {
    expect(ids({ kcalObjectif: 1300 })).toContain("objectif-sous-mb");
    expect(ids({ kcalObjectif: 1420 })).toContain("deficit-fort");
  });
  it("protéines basses : objectif en grammes", () => {
    const a = analyserCliente({ ...base, plan: { depuis: "2026-11-01", kcal: 1650, proteines: 80 }, poids: pesees(70, -0.5, 4) });
    expect(a.conseils.find((c) => c.id === "proteines")?.actions[0]).toMatch(/109 à 136 g/);
  });
  it("besoins calculés avec un ancien poids, plan ancien", () => {
    const r = ids({ poids: pesees(66, 0, 1), plan: { depuis: "2026-08-15", kcal: 1650, proteines: 120 } });
    expect(r).toEqual(expect.arrayContaining(["besoins-obsoletes", "plan-ancien"]));
  });
  it("faim et plan qui ne convient pas", () => {
    const ressentis = [
      { date: "2026-11-09", energie: 6, sommeil: 6, stress: 5, faim: null, finirRepas: "Oui, mais j’ai encore faim", planConvient: "Plutôt oui" },
      { date: "2026-11-16", energie: 6, sommeil: 6, stress: 5, faim: null, finirRepas: "Oui, mais j’ai encore faim", planConvient: "Pas vraiment" },
    ];
    const a = analyserCliente({ ...base, ressentis });
    expect(a.conseils.find((c) => c.id === "faim")?.niveau).toBe("important");
    expect(a.conseils.map((c) => c.id)).toContain("plan-ne-convient-pas");
  });
});

describe("récupération, activité, entraînement, suivi", () => {
  const jours = (n: number, f: (i: number) => Partial<DonneesAnalyse["journal"][number]>) =>
    Array.from({ length: n }, (_, i) => ({ jour: ajouterJours(AUJ, -i), sommeil: null, hydratation: null, pas: null, stress: null, digestion: null, ...f(i) }));
  it("fatigue + perte rapide = important ; sommeil, pas, hydratation", () => {
    const ressentis = [{ date: "2026-11-16", energie: 3, sommeil: 4, stress: 8, faim: null, finirRepas: null, planConvient: null }];
    const r = analyserCliente({ ...base, ressentis, poids: pesees(70, -1.2, 4), journal: jours(10, () => ({ sommeil: 6, pas: 4200, hydratation: 1 })) });
    expect(r.conseils.find((c) => c.id === "fatigue")?.niveau).toBe("important");
    expect(r.conseils.map((c) => c.id)).toEqual(expect.arrayContaining(["sommeil", "stress", "pas", "hydratation"]));
  });
  it("activité en baisse", () => {
    expect(ids({ journal: jours(28, (i) => ({ pas: i < 14 ? 6500 : 10000 })) })).toContain("pas-baisse");
  });
  it("séances : aucune depuis 2 semaines, régularité, bravo", () => {
    const programme = { depuis: "2026-10-01", seancesParSemaine: 3 };
    expect(ids({ programme, seancesFaites: ["2026-11-01"] })).toContain("plus-de-seances");
    expect(ids({ programme, seancesFaites: ["2026-11-20", "2026-11-05"] })).toContain("regularite-sport");
    const toutes = Array.from({ length: 12 }, (_, i) => ajouterJours(AUJ, -2 * i - 1));
    expect(ids({ programme, seancesFaites: toutes })).toContain("bravo-sport");
  });
  it("séances express : comptées à part, sans fausser le suivi du programme", () => {
    const programme = { depuis: "2026-10-01", seancesParSemaine: 3 };
    const express = [ajouterJours(AUJ, -2), ajouterJours(AUJ, -5), ajouterJours(AUJ, -9)];
    const r = ids({ programme, seancesFaites: ["2026-11-01"], seancesExpress: express });
    expect(r).toContain("seances-express-a-la-place");
    expect(r).not.toContain("plus-de-seances");
    expect(r).toContain("seances-express");
    // Elles ne comptent pas comme des séances du programme.
    expect(ids({ programme, seancesFaites: [], seancesExpress: Array.from({ length: 12 }, (_, i) => ajouterJours(AUJ, -2 * i - 1)) })).not.toContain("bravo-sport");
  });
  it("charges : plateau et progrès", () => {
    const charges = [
      { exercice: "Squat goblet", seances: [{ date: "2026-10-20", max: 12 }, { date: "2026-11-02", max: 16 }, { date: "2026-11-10", max: 16 }, { date: "2026-11-20", max: 16 }] },
    ];
    expect(ids({ charges })).toEqual(expect.arrayContaining(["plateau-charges", "bravo-charges"]));
  });
  it("engagement et fin de suivi ; l'important passe en premier", () => {
    const a = analyserCliente({ ...base, bilansManques: 2, joursSansConnexion: 12, finCoaching: "2026-12-05", poids: pesees(72, -0.5, 6) });
    expect(a.conseils.map((c) => c.id)).toEqual(expect.arrayContaining(["bilans-manques", "decrochage", "fin-suivi"]));
    expect(a.conseils[0].niveau).toBe("important");
    expect(a.conseils.at(-1)?.niveau).toBe("bravo");
  });
});
