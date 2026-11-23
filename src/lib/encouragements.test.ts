import { describe, expect, it } from "vitest";
import { ajouterJours } from "./bilan";
import { ENCOURAGEMENTS, encouragementDuJour } from "./encouragements";

describe("encouragement du jour", () => {
  it("la même phrase toute la journée, une autre le lendemain", () => {
    expect(encouragementDuJour("2026-11-23")).toBe(encouragementDuJour("2026-11-23"));
    expect(encouragementDuJour("2026-11-24")).not.toBe(encouragementDuJour("2026-11-23"));
  });
  it("aucune répétition avant d'avoir fait le tour de toutes les phrases", () => {
    const n = ENCOURAGEMENTS.length;
    const vues = new Set(Array.from({ length: n }, (_, i) => encouragementDuJour(ajouterJours("2026-11-23", i))));
    expect(vues.size).toBe(n);
  });
  it("fonctionne avant la date de départ et avec n'importe quelle liste", () => {
    expect(ENCOURAGEMENTS).toContain(encouragementDuJour("2025-03-01"));
    const liste = ["a", "b", "c", "d"];
    expect(new Set(["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"].map((j) => encouragementDuJour(j, liste))).size).toBe(4);
  });
  it("des phrases uniques et pas trop longues pour un écran de téléphone", () => {
    expect(new Set(ENCOURAGEMENTS).size).toBe(ENCOURAGEMENTS.length);
    for (const p of ENCOURAGEMENTS) expect(p.length).toBeLessThanOrEqual(90);
  });
});
