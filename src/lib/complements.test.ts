import { describe, expect, it } from "vitest";
import { parMoment, rappelComplementsDu, texteRappelComplements, type Complement } from "./complements";

const c = (nom: string, moment: Complement["moment"], ordre = 0): Complement => ({ id: nom, nom, moment, quantite: "1", note: null, ordre, actif: true });

describe("compléments", () => {
  it("rangés par moment de la journée", () => {
    const g = parMoment([c("Magnésium", "coucher"), c("Vitamine D", "matin", 2), c("Oméga 3", "matin", 1)]);
    expect(g.map((x) => x.libelle)).toEqual(["Le matin", "Au coucher"]);
    expect(g[0].complements.map((x) => x.nom)).toEqual(["Oméga 3", "Vitamine D"]);
  });

  it("rappel : à l'heure choisie, une fois par jour, seulement s'il reste quelque chose", () => {
    const base = { heure: "08:00", maintenant: "08:10", envoyeLe: null, aujourdhui: "2026-11-24", resteAPrendre: 2 };
    expect(rappelComplementsDu(base)).toBe(true);
    expect(rappelComplementsDu({ ...base, maintenant: "07:50" })).toBe(false);
    expect(rappelComplementsDu({ ...base, envoyeLe: "2026-11-24" })).toBe(false);
    expect(rappelComplementsDu({ ...base, resteAPrendre: 0 })).toBe(false);
    expect(rappelComplementsDu({ ...base, heure: null })).toBe(false);
  });

  it("texte discret", () => {
    expect(texteRappelComplements(["Magnésium"])).toBe("Petit rappel : Magnésium 🌿");
    expect(texteRappelComplements(["A", "B", "C", "D", "E"])).toBe("Petit rappel : A, B, C et 2 autres 🌿");
  });
});
