import { describe, expect, it } from "vitest";
import type { Exercice, Seance } from "./programme-sportif";
import { chargeProposee, derniereFois, etapesSeance, formaterDuree, formaterKg, lireFormat, lireKg, lireSecondes, nombreSeries, phaseIntervalle, regrouperCharges } from "./seance-guidee";

const ex = (nom: string, o: Partial<Exercice> = {}): Exercice => ({ nom, series: null, repetitions: null, charge: null, repos: null, tempo: null, consignes: null, ...o });

describe("lecture des textes de Claude", () => {
  it("repos en secondes", () => {
    expect(lireSecondes("90 s")).toBe(90);
    expect(lireSecondes("90s")).toBe(90);
    expect(lireSecondes("1 min 30")).toBe(90);
    expect(lireSecondes("1'30")).toBe(90);
    expect(lireSecondes("1:30")).toBe(90);
    expect(lireSecondes("2 min")).toBe(120);
    expect(lireSecondes("1,5 min")).toBe(90);
    expect(lireSecondes("60-90 s")).toBe(90);
    expect(lireSecondes("libre")).toBeNull();
    expect(lireSecondes(null)).toBeNull();
  });
  it("nombre de séries", () => {
    expect(nombreSeries("4")).toBe(4);
    expect(nombreSeries("3-4")).toBe(4);
    expect(nombreSeries(null)).toBe(1);
  });
  it("formats de bloc", () => {
    expect(lireFormat("4 séries")).toEqual({ mode: "series" });
    expect(lireFormat(null)).toEqual({ mode: "series" });
    expect(lireFormat("AMRAP 10 min")).toEqual({ mode: "amrap", secondes: 600, intervalle: null });
    expect(lireFormat("EMOM 12 min")).toEqual({ mode: "emom", secondes: 720, intervalle: 60 });
    expect(lireFormat("E2MOM 10 min")).toEqual({ mode: "emom", secondes: 600, intervalle: 120 });
    expect(lireFormat("For time (cap 15 min)")).toEqual({ mode: "fortime", secondes: 900, intervalle: null });
    expect(lireFormat("For time")).toEqual({ mode: "fortime", secondes: null, intervalle: null });
    expect(lireFormat("Tabata")).toEqual({ mode: "tabata", secondes: 240, intervalle: 20 });
    expect(lireFormat("3 tours – repos 2 min entre les tours")).toEqual({ mode: "circuit", tours: 3, reposTours: 120 });
    expect(lireFormat("Superset")).toEqual({ mode: "circuit", tours: null, reposTours: null });
  });
});

describe("étapes d'une séance", () => {
  const seance: Seance = {
    nom: "Séance A",
    jour: null,
    duree: null,
    echauffement: "5 min rameur",
    blocs: [
      { titre: "Force", format: "séries", exercices: [ex("Squat", { series: "3", repetitions: "10", repos: "90 s" }), ex("Fentes", { series: "2", repetitions: "12", repos: "60 s" })] },
      { titre: "Circuit", format: "2 tours – repos 1 min entre les tours", exercices: [ex("Pompes", { repetitions: "10" }), ex("Gainage", { repetitions: "30 s" })] },
      { titre: "Metcon", format: "AMRAP 8 min", exercices: [ex("Wall ball"), ex("Rameur")] },
    ],
    retour_au_calme: "Étirements",
    notes: null,
  };
  const etapes = etapesSeance(seance);
  const resume = etapes.map((e) =>
    e.type === "serie" ? `${e.exercice.nom} ${e.numero}/${e.total}` : e.type === "repos" ? `repos ${e.secondes}` : e.type === "chrono" ? `${e.mode} ${e.secondes}` : e.titre,
  );
  it("série → repos → série suivante, exercice après exercice", () => {
    expect(resume).toEqual([
      "Échauffement",
      "Squat 1/3", "repos 90", "Squat 2/3", "repos 90", "Squat 3/3", "repos 90",
      "Fentes 1/2", "repos 60", "Fentes 2/2", "repos 60",
      "Pompes 1/2", "Gainage 1/2", "repos 60", "Pompes 2/2", "Gainage 2/2", "repos 60",
      "amrap 480",
      "Retour au calme",
    ]);
  });
  it("le repos annonce la suite", () => {
    const r = etapes[2];
    expect(r.type === "repos" && r.ensuite).toBe("Squat · série 2/3");
    const avantAmrap = etapes[16];
    expect(avantAmrap.type === "repos" && avantAmrap.ensuite).toBe("Metcon · AMRAP 8 min");
  });
  it("pas de repos à la fin ni avant le retour au calme", () => {
    const fin = etapesSeance({ ...seance, blocs: [seance.blocs[0]], retour_au_calme: "Étirements" });
    expect(fin.at(-2)?.type).toBe("serie");
    const sans = etapesSeance({ ...seance, echauffement: null, blocs: [seance.blocs[0]], retour_au_calme: null });
    expect(sans.at(-1)?.type).toBe("serie");
  });
});

describe("minuteurs", () => {
  it("affichage", () => {
    expect(formaterDuree(90)).toBe("1:30");
    expect(formaterDuree(5.2)).toBe("0:06");
    expect(formaterDuree(-3)).toBe("0:00");
  });
  it("EMOM et Tabata", () => {
    expect(phaseIntervalle("emom", 60, 0)).toEqual({ tour: 1, phase: "effort", reste: 60 });
    expect(phaseIntervalle("emom", 60, 125)).toEqual({ tour: 3, phase: "effort", reste: 55 });
    expect(phaseIntervalle("tabata", 20, 25)).toEqual({ tour: 1, phase: "repos", reste: 5 });
    expect(phaseIntervalle("tabata", 20, 31)).toEqual({ tour: 2, phase: "effort", reste: 19 });
  });
});

describe("poids utilisés", () => {
  const lignes = [
    { seance_ref: "s1", exercice_cle: "squat goblet", serie: 1, charge_kg: "12.0", faite_le: "2026-11-10T09:00:00Z" },
    { seance_ref: "s1", exercice_cle: "squat goblet", serie: 2, charge_kg: "12.0", faite_le: "2026-11-10T09:05:00Z" },
    { seance_ref: "s2", exercice_cle: "squat goblet", serie: 2, charge_kg: "16.0", faite_le: "2026-11-16T09:05:00Z" },
    { seance_ref: "s2", exercice_cle: "squat goblet", serie: 1, charge_kg: "14.0", faite_le: "2026-11-16T09:00:00Z" },
    { seance_ref: "s2", exercice_cle: "rameur", serie: 1, charge_kg: "0", faite_le: "2026-11-16T09:20:00Z" },
  ];
  const h = regrouperCharges(lignes);
  it("lit et affiche les kilos", () => {
    expect(lireKg("14,5")).toBe(14.5);
    expect(lireKg("14.5 kg")).toBe(14.5);
    expect(lireKg("")).toBeNull();
    expect(lireKg("lourd")).toBeNull();
    expect(lireKg("9999")).toBeNull();
    expect(formaterKg(14.5)).toBe("14,5");
    expect(formaterKg(16)).toBe("16");
  });
  it("regroupe par exercice et par séance, la plus récente d'abord", () => {
    expect(h["squat goblet"].map((s) => s.ref)).toEqual(["s2", "s1"]);
    expect(h["squat goblet"][0].series).toEqual([{ serie: 1, kg: 14 }, { serie: 2, kg: 16 }]);
  });
  it("la dernière fois, sans compter la séance en cours", () => {
    expect(derniereFois(h, "squat goblet", null)?.ref).toBe("s2");
    expect(derniereFois(h, "squat goblet", "s2")?.ref).toBe("s1");
    expect(derniereFois(h, "inconnu", null)).toBeNull();
  });
  it("poids proposé", () => {
    const d = derniereFois(h, "squat goblet", null);
    expect(chargeProposee({}, "squat goblet", 2, d)).toBe(16); // même série la dernière fois
    expect(chargeProposee({}, "squat goblet", 4, d)).toBe(16); // sinon sa dernière charge
    expect(chargeProposee({ "squat goblet#1": 18 }, "squat goblet", 2, d)).toBe(18); // série d'avant aujourd'hui
    expect(chargeProposee({}, "squat goblet", 1, null)).toBeNull();
  });
});
