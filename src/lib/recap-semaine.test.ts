import { describe, expect, it } from "vitest";
import { calculerRecap, dimancheDuRecap, formaterHeures, recapADonner, recapRecent, texteNotificationRecap } from "./recap-semaine";

// Semaine du lundi 16 au dimanche 22 novembre 2026.
const DIM = "2026-11-22";
const j = (jour: string, sommeil: number | null, pas: number | null, hydratation: number | null) => ({ jour, sommeil, pas, hydratation });

describe("récap de la semaine", () => {
  it("compte les séances et fait les moyennes du lundi au dimanche seulement", () => {
    const r = calculerRecap({
      dimanche: DIM,
      prenom: "Léa",
      seances: ["2026-11-15", "2026-11-16", "2026-11-18", "2026-11-22", "2026-11-23"],
      journal: [j("2026-11-15", 4, 1000, 0.5), j("2026-11-16", 7, 8000, 1.5), j("2026-11-17", 8, null, 2), j("2026-11-22", null, 6000, null)],
    });
    expect(r.lundi).toBe("2026-11-16");
    expect(r.seances).toBe(3);
    expect(r.joursRemplis).toBe(3);
    expect(r.sommeil).toBe(7.5);
    expect(r.pas).toBe(7000);
    expect(r.hydratation).toBe(1.75);
    expect(r.phrase).toContain("Léa, quelle semaine ! 3 séances");
    expect(texteNotificationRecap(r).replace(/\s/g, " ")).toBe("3 séances · 7 h 30 de sommeil · 7 000 pas/jour. Viens voir ta semaine 💛");
  });

  it("semaine vide : une phrase douce, jamais culpabilisante", () => {
    const r = calculerRecap({ dimanche: DIM, prenom: "Léa", seances: [], journal: [] });
    expect(r.sommeil).toBeNull();
    expect(r.phrase).toMatch(/on repart ensemble/);
    expect(texteNotificationRecap(r)).toBe("0 séance. Viens voir ta semaine 💛");
  });

  it("quelle semaine montrer", () => {
    expect(dimancheDuRecap("2026-11-22", "17:59")).toBe("2026-11-15");
    expect(dimancheDuRecap("2026-11-22", "18:00")).toBe("2026-11-22");
    expect(dimancheDuRecap("2026-11-24", "09:00")).toBe("2026-11-22");
    expect(recapRecent("2026-11-24", "09:00")).toBe("2026-11-22");
    expect(recapRecent("2026-11-25", "09:00")).toBeNull();
    expect(recapRecent("2026-11-22", "12:00")).toBeNull();
  });

  it("la notification part le dimanche à partir de 18 h, une seule fois", () => {
    expect(recapADonner({ aujourdhui: DIM, heure: "17:45", dejaEnvoye: null })).toBe(false);
    expect(recapADonner({ aujourdhui: DIM, heure: "18:00", dejaEnvoye: "2026-11-15" })).toBe(true);
    expect(recapADonner({ aujourdhui: DIM, heure: "18:15", dejaEnvoye: DIM })).toBe(false);
    expect(recapADonner({ aujourdhui: "2026-11-23", heure: "18:00", dejaEnvoye: null })).toBe(false);
  });

  it("heures lisibles", () => {
    expect(formaterHeures(7)).toBe("7 h");
    expect(formaterHeures(6.75)).toBe("6 h 45");
  });
});
