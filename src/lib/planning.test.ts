import { describe, expect, it } from "vitest";
import { additionner, joursSemaine, lundiDe, titreLotSemaine } from "./planning";

describe("planning des repas", () => {
  it("les 7 jours de la semaine, du lundi au dimanche", () => {
    expect(lundiDe("2026-11-26")).toBe("2026-11-23");
    expect(joursSemaine("2026-11-23")).toEqual(["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"]);
    expect(titreLotSemaine("2026-11-23")).toBe("Planning de la semaine du 23/11");
  });

  it("additionne les quantités par aliment et par unité", () => {
    const r = additionner([
      { aliment_id: "riz", nom: "Riz", unite: "g", nom_unite: null, quantite: 60.25 },
      { aliment_id: "oeuf", nom: "Œuf", unite: "unite", nom_unite: "œuf", quantite: 2 },
      { aliment_id: "riz", nom: "Riz", unite: "g", nom_unite: null, quantite: 80 },
      { aliment_id: "oeuf", nom: "Œuf", unite: "unite", nom_unite: "œuf", quantite: 1 },
      { aliment_id: "sel", nom: "Sel", unite: "g", nom_unite: null, quantite: 0 },
    ]);
    expect(r).toEqual([
      { aliment_id: "oeuf", nom: "Œuf", unite: "unite", nom_unite: "œuf", quantite: 3 },
      { aliment_id: "riz", nom: "Riz", unite: "g", nom_unite: null, quantite: 140.3 },
    ]);
  });
});
