import { describe, expect, it } from "vitest";
import { ajouterJours } from "./bilan";
import { debutsDeCycle, lireSymptomes, messageRetention, situationCycle } from "./cycle";

const D = "2026-11-01";
const regles = [0, 1, 2, 3, 4].map((i) => ajouterJours(D, i));

describe("cycle", () => {
  it("repère les débuts de cycle (un jour oublié au milieu des règles ne compte pas)", () => {
    expect(debutsDeCycle([...regles, ajouterJours(D, 6), "2026-11-29", "2026-11-30"])).toEqual([D, "2026-11-29"]);
  });

  it("jour et phase", () => {
    expect(situationCycle(regles, D)).toMatchObject({ jour: 1, phase: "regles", retention: true });
    expect(situationCycle(regles, ajouterJours(D, 7))).toMatchObject({ jour: 8, phase: "folliculaire", retention: false });
    expect(situationCycle(regles, ajouterJours(D, 13))).toMatchObject({ jour: 14, phase: "ovulation" });
    expect(situationCycle(regles, ajouterJours(D, 18))).toMatchObject({ jour: 19, phase: "luteale", retention: false });
    expect(situationCycle(regles, ajouterJours(D, 24))).toMatchObject({ jour: 25, phase: "luteale", retention: true });
    // Cycle plus long : l'ovulation est plus tard.
    expect(situationCycle(regles, ajouterJours(D, 17), 32)?.phase).toBe("ovulation");
  });

  it("rien sans règles notées, ni si le dernier cycle est trop ancien", () => {
    expect(situationCycle([], D)).toBeNull();
    expect(situationCycle(regles, ajouterJours(D, 50))).toBeNull();
  });

  it("message doux si le poids monte pendant une phase de rétention", () => {
    const pesees = [1, 2, 3].map((i) => ({ jour: ajouterJours(D, 22 - i), poids: 62 }));
    const base = { mode: "cycle" as const, sansChiffres: false, jour: ajouterJours(D, 24), poidsDuJour: 62.6, pesees, joursRegles: regles, duree: 28 };
    expect(messageRetention(base)).toMatch(/normal en ce moment/);
    expect(messageRetention({ ...base, poidsDuJour: 62.1 })).toBeNull();
    expect(messageRetention({ ...base, jour: ajouterJours(D, 10) })).toBeNull();
    expect(messageRetention({ ...base, sansChiffres: true })).toBeNull();
    expect(messageRetention({ ...base, mode: "perimenopause" })).toBeNull();
  });

  it("seuls les symptômes de la liste sont gardés", () => {
    expect(lireSymptomes(["bouffees", "pirate", "bouffees", "fatigue"])).toEqual(["bouffees", "fatigue"]);
  });
});
