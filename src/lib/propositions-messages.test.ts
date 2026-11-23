import { describe, expect, it } from "vitest";
import { ajouterJours } from "./bilan";
import { proposerMessages, semaineIso, type DonneesSemaine, type JourJournal } from "./propositions-messages";

const AUJ = "2026-11-23";
const jour = (i: number, v: Partial<JourJournal>): JourJournal => ({ jour: ajouterJours(AUJ, -i), sommeil: null, hydratation: null, pas: null, stress: null, poids: null, ...v });
/** 7 jours cette semaine (0-6) et 7 jours la semaine d'avant (7-13). */
const deuxSemaines = (cette: Partial<JourJournal>, avant: Partial<JourJournal>) => [
  ...Array.from({ length: 7 }, (_, i) => jour(i, cette)),
  ...Array.from({ length: 7 }, (_, i) => jour(i + 7, avant)),
];
const base: DonneesSemaine = { clienteId: "c1", prenom: "Léa", sansChiffres: false, objectif: "perte", journal: [], seancesFaites: [], avecProgramme: true };
const types = (d: Partial<DonneesSemaine>) => proposerMessages({ ...base, ...d }, AUJ).map((p) => p.cle.split(":")[0]);

describe("propositions de messages", () => {
  it("semaine ISO", () => {
    expect(semaineIso("2026-11-23")).toBe("2026-W48");
    expect(semaineIso("2027-01-01")).toBe("2026-W53");
    expect(semaineIso("2026-01-01")).toBe("2026-W01");
  });
  it("NEAT en baisse : message prêt, avec le prénom et les chiffres pour la coach", () => {
    const [p] = proposerMessages({ ...base, journal: deuxSemaines({ pas: 5000 }, { pas: 9000 }) }, AUJ);
    expect(p.cle).toBe("pas_baisse:2026-W48");
    expect(p.constat).toMatch(/5\s000 pas.*9\s000.*−44 %/);
    expect(p.message).toMatch(/^Coucou Léa/);
  });
  it("moins de sommeil, plus de stress, moins d'eau", () => {
    expect(types({ journal: deuxSemaines({ sommeil: 6 }, { sommeil: 7.5 }) })).toEqual(["sommeil_baisse"]);
    expect(types({ journal: deuxSemaines({ stress: 4 }, { stress: 2.5 }) })).toEqual(["stress_hausse"]);
    expect(types({ journal: deuxSemaines({ hydratation: 1 }, { hydratation: 1.8 }) })).toEqual(["hydratation_baisse"]);
  });
  it("journal abandonné, séances arrêtées", () => {
    expect(types({ journal: Array.from({ length: 6 }, (_, i) => jour(i + 7, { pas: 8000 })) })).toEqual(["journal_abandon"]);
    expect(types({ seancesFaites: ["2026-11-14", "2026-11-12"] })).toEqual(["seances_baisse"]);
  });
  it("bravos : pas, sommeil, séances, poids (jamais en mode sans chiffres)", () => {
    expect(types({ journal: deuxSemaines({ pas: 9000 }, { pas: 6000 }) })).toEqual(["pas_hausse"]);
    expect(types({ journal: deuxSemaines({ sommeil: 7.5 }, { sommeil: 6.5 }) })).toEqual(["sommeil_hausse"]);
    expect(types({ seancesFaites: ["2026-11-23", "2026-11-21", "2026-11-19", "2026-11-14"] })).toEqual(["seances_hausse"]);
    expect(types({ journal: deuxSemaines({ poids: 68.2 }, { poids: 68.8 }) })).toEqual(["poids_baisse"]);
    expect(types({ sansChiffres: true, journal: deuxSemaines({ poids: 68.2 }, { poids: 68.8 }) })).toEqual([]);
  });
  it("au plus 2 relances et un bravo ; rien si pas assez de données", () => {
    const r = types({ journal: deuxSemaines({ sommeil: 6, pas: 5000, poids: 68, hydratation: 1 }, { sommeil: 7.5, pas: 9000, poids: 68.5, hydratation: 1.8 }) });
    expect(r).toEqual(["sommeil_baisse", "pas_baisse", "poids_baisse"]);
    expect(types({ journal: [jour(0, { pas: 1000 }), jour(8, { pas: 9000 })] })).toEqual([]);
  });
});
