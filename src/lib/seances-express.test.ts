import { describe, expect, it } from "vitest";
import { accesExpress, extraireSeance, filtrerExpress, lireFiltres, lireListe } from "./seances-express";

const seance = { nom: "Cardio salon", duree: "10 min", blocs: [{ titre: "Tabata", format: "Tabata", exercices: [{ nom: "Jumping jacks" }, { nom: "Squats" }] }] };

describe("séances express", () => {
  it("lit une séance seule collée depuis Claude", () => {
    const r = extraireSeance("Voici ta séance :\n```json\n" + JSON.stringify(seance) + "\n```");
    expect(r.seance?.nom).toBe("Cardio salon");
    expect(r.seance?.blocs[0].exercices.map((e) => e.nom)).toEqual(["Jumping jacks", "Squats"]);
  });

  it("accepte aussi un programme (première séance) et refuse un texte sans séance", () => {
    expect(extraireSeance(JSON.stringify({ titre: "P", seances: [seance] })).seance?.nom).toBe("Cardio salon");
    expect(extraireSeance("bonjour").erreur).toBeTruthy();
    expect(extraireSeance(JSON.stringify({ nom: "Vide", blocs: [] })).erreur).toMatch(/aucun bloc/);
  });

  it("accès : en cours de suivi, ou suivi terminé jusqu'à la date choisie", () => {
    expect(accesExpress({ statut: "active" }, "2026-11-24")).toBe(true);
    expect(accesExpress({ statut: "terminee", express_jusqu_au: null }, "2026-11-24")).toBe(false);
    expect(accesExpress({ statut: "terminee", express_jusqu_au: "2026-11-24" }, "2026-11-24")).toBe(true);
    expect(accesExpress({ statut: "terminee", express_jusqu_au: "2026-11-23" }, "2026-11-24")).toBe(false);
    expect(accesExpress({ statut: "fermee", express_jusqu_au: "2027-01-01" }, "2026-11-24")).toBe(false);
  });

  it("filtres : durée, type, matériel, favoris", () => {
    const l = [
      { id: "a", duree_minutes: 10, materiel: [], type: "Cardio" },
      { id: "b", duree_minutes: 20, materiel: ["Tapis"], type: "Mobilité" },
      { id: "c", duree_minutes: 10, materiel: ["Haltères", "Tapis"], type: "Renfo" },
    ];
    const ids = (f: Parameters<typeof lireFiltres>[0], fav = new Set<string>()) => filtrerExpress(l, lireFiltres(f), fav).map((x) => x.id);
    expect(ids({ duree: "10" })).toEqual(["a", "c"]);
    expect(ids({ duree: "45" })).toEqual(["a", "b", "c"]);
    expect(ids({ materiel: "Aucun" })).toEqual(["a"]);
    expect(ids({ materiel: "Tapis" })).toEqual(["a", "b", "c"]);
    expect(ids({ materiel: "Haltères", type: "Renfo" })).toEqual(["c"]);
    expect(ids({ favoris: "1" }, new Set(["b"]))).toEqual(["b"]);
  });

  it("listes de Réglages : une valeur par ligne, sans doublon", () => {
    expect(lireListe("Tapis\n\n  Élastique \ntapis\nHaltères")).toEqual(["Tapis", "Élastique", "Haltères"]);
  });
});
