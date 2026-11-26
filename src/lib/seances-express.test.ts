import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { etapesSeance } from "./seance-guidee";
import { DUREES_EXPRESS, accesExpress, extraireSeance, filtrerExpress, lireContenuExpress, lireFiltres, lireListe } from "./seances-express";

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

  it("accès : en cours de suivi, et à vie après le suivi", () => {
    expect(accesExpress({ statut: "active" })).toBe(true);
    // Accès à vie après le suivi (0044).
    expect(accesExpress({ statut: "terminee" })).toBe(true);
    expect(accesExpress({ statut: "fermee" })).toBe(false);
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

describe("séances express de départ (migration 0041)", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/0041_seances_express_depart.sql"), "utf8");
  const lignes = [...sql.matchAll(/\(\s*'((?:[^']|'')+)',\s*'(?:[^']|'')*',\s*(\d+),[^$]*\$seance\$([\s\S]*?)\$seance\$/g)];

  it("contient une bibliothèque variée", () => {
    expect(lignes.length).toBeGreaterThanOrEqual(15);
    const durees = new Set(lignes.map((l) => Number(l[2])));
    expect([...durees].sort((a, b) => a - b)).toEqual([...DUREES_EXPRESS]);
    for (const type of ["Renfo", "Cardio", "Mobilité", "Étirements", "Marche à la maison", "Gainage"]) {
      expect(sql).toContain(`'${type}'`);
    }
  });

  it("chaque séance se lit et se joue en mode guidé", () => {
    for (const [, titre, , json] of lignes) {
      const seance = lireContenuExpress(JSON.parse(json), titre.replace(/''/g, "'"));
      expect(seance, titre).not.toBeNull();
      const etapes = etapesSeance(seance!);
      expect(etapes.some((e) => e.type === "serie" || e.type === "chrono"), titre).toBe(true);
    }
  });

  it("toutes en brouillon : rien n'est publié sans relecture", () => {
    expect(sql).toMatch(/v\.contenu, false, 'toutes'/);
    expect(sql).toContain("where not exists");
  });
});
