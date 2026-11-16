import { describe, expect, it } from "vitest";
import { ecartsMensuels, lireHeures, lireNombre, numeroSemaine, semainesJournal, syntheseJournal, type EntreeJournal } from "./journal";

const e = (jour: string, v: Partial<EntreeJournal> = {}): EntreeJournal => ({
  jour, poids: null, tour_taille: null, sommeil: null, hydratation: null, pas: null,
  trainings: null, stress: null, digestion: null, regles: false, observations: null, ...v,
});

describe("journal quotidien", () => {
  it("numérote les semaines depuis le démarrage", () => {
    expect(numeroSemaine("2026-10-19", "2026-10-19")).toBe(1);
    expect(numeroSemaine("2026-10-19", "2026-10-25")).toBe(1);
    expect(numeroSemaine("2026-10-19", "2026-10-26")).toBe(2);
  });

  it("moyennes de la semaine, total des trainings, jours de règles", () => {
    const s = semainesJournal(
      [
        e("2026-10-19", { poids: 60.4, sommeil: 6.5, trainings: 1, stress: 2, regles: true }),
        e("2026-10-21", { poids: 60.7, sommeil: 7.5, trainings: 1, stress: 1 }),
        e("2026-10-23", { sommeil: 8, pas: 9000 }),
      ],
      "2026-10-19",
      "2026-10-24",
    );
    expect(s).toHaveLength(1);
    expect(s[0].valeurs.poids).toBe(60.55);
    expect(s[0].valeurs.sommeil).toBe(7.33);
    expect(s[0].valeurs.trainings).toBe(2);
    expect(s[0].valeurs.pas).toBe(9000);
    expect(s[0].joursRegles).toBe(1);
    expect(s[0].joursRemplis).toBe(3);
    expect(s[0].jours[1]).toBeNull();
  });

  it("semaines de la plus récente à la plus ancienne, jusqu'à aujourd'hui", () => {
    const s = semainesJournal([e("2026-10-20", { poids: 60 })], "2026-10-19", "2026-11-03");
    expect(s.map((x) => x.numero)).toEqual([3, 2, 1]);
    expect(s[0].debut).toBe("2026-11-02");
    expect(s[0].fin).toBe("2026-11-08");
  });

  it("écarts mensuels et synthèse, comme le tableau", () => {
    const entrees: EntreeJournal[] = [];
    for (let i = 0; i < 56; i++) {
      const d = new Date(Date.UTC(2026, 9, 19 + i)).toISOString().slice(0, 10);
      const semaine = Math.floor(i / 7);
      entrees.push(e(d, { poids: 61 - semaine * 0.2, tour_taille: 78 - semaine * 0.5, trainings: i % 2, sommeil: 7 }));
    }
    const s = semainesJournal(entrees, "2026-10-19", "2026-12-13");
    expect(ecartsMensuels(s)).toEqual([
      { mois: 1, poids: -0.6, tour_taille: -1.5 },
      { mois: 2, poids: -1.4, tour_taille: -3.5 },
    ]);
    const syn = syntheseJournal(s);
    expect(syn.poidsDepart).toBe(61);
    expect(syn.poidsActuel).toBe(59.6);
    expect(syn.variationPoids).toBe(-1.4);
    expect(syn.totalTrainings).toBe(28);
    expect(syn.trainingsParSemaine).toBe(3.5);
    expect(syn.sommeil).toBe(7);
  });

  it("lit les heures et les nombres à la française", () => {
    expect(lireHeures("7h30")).toBe(7.5);
    expect(lireHeures("7:15")).toBe(7.25);
    expect(lireHeures("6,5")).toBe(6.5);
    expect(lireHeures("8h")).toBe(8);
    expect(lireHeures("")).toBeNull();
    expect(lireNombre("8 500")).toBe(8500);
    expect(lireNombre("61,4")).toBe(61.4);
    expect(Number.isNaN(lireNombre("abc"))).toBe(true);
  });
});

import { heureParis, rappelJournalDu } from "./journal";
describe("rappel du journal", () => {
  const base = { heure: "20:30:00", maintenant: "20:35", envoyeLe: null, aujourdhui: "2026-11-16", journeeRemplie: false };
  it("part après l'heure choisie, une fois par jour, si la journée n'est pas remplie", () => {
    expect(rappelJournalDu(base)).toBe(true);
    expect(rappelJournalDu({ ...base, maintenant: "20:29" })).toBe(false);
    expect(rappelJournalDu({ ...base, maintenant: "23:40" })).toBe(false);
    expect(rappelJournalDu({ ...base, envoyeLe: "2026-11-16" })).toBe(false);
    expect(rappelJournalDu({ ...base, envoyeLe: "2026-11-15" })).toBe(true);
    expect(rappelJournalDu({ ...base, journeeRemplie: true })).toBe(false);
    expect(rappelJournalDu({ ...base, heure: null })).toBe(false);
  });
  it("heure de Paris", () => {
    expect(heureParis(new Date("2026-11-16T19:30:00Z"))).toBe("20:30");
    expect(heureParis(new Date("2026-07-01T05:05:00Z"))).toBe("07:05");
  });
});
