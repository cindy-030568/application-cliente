import { describe, expect, it } from "vitest";
import {
  correspond,
  dureeCourte,
  estTerminee,
  extrait,
  filtrerRessources,
  formatAudio,
  horloge,
  lireFiltresRessources,
  normaliser,
  positionDeReprise,
} from "./ressources";

const CAT = "11111111-1111-4111-8111-111111111111";
const liste = [
  { id: "1", titre: "Je mange dehors", description: "Restaurant, boulangerie", contenu: "## Au restaurant\nRepère les **protéines** et les légumes.", categorie_id: CAT, audio_path: null },
  { id: "2", titre: "Relaxation du soir", description: "Pour mieux dormir", contenu: null, categorie_id: null, audio_path: "a.m4a" },
  { id: "3", titre: "Guide protéines", description: null, contenu: null, categorie_id: CAT, audio_path: "b.mp3" },
];
const sans = { q: "", categorie: null, ecouter: false, favoris: false };

describe("ressources : recherche et filtres", () => {
  it("cherche sans accents ni majuscules", () => {
    expect(normaliser("  Évite l’ŒUF  ")).toBe("evite l oeuf");
    expect(correspond(liste[0], "BOULANGERIE")).toBe(true);
    expect(correspond(liste[0], "legumes")).toBe(true); // dans le texte de la fiche
    expect(correspond(liste[1], "relaxation dormir")).toBe(true); // mots dans n'importe quel ordre
    expect(correspond(liste[1], "relaxation matin")).toBe(false);
  });
  it("classe les résultats : le titre d'abord", () => {
    expect(filtrerRessources(liste, { ...sans, q: "protéines" }, new Set()).map((r) => r.id)).toEqual(["3", "1"]);
  });
  it("filtre par catégorie, « À écouter » et favoris", () => {
    expect(filtrerRessources(liste, { ...sans, categorie: CAT }, new Set()).map((r) => r.id)).toEqual(["1", "3"]);
    expect(filtrerRessources(liste, { ...sans, categorie: "autres" }, new Set()).map((r) => r.id)).toEqual(["2"]);
    expect(filtrerRessources(liste, { ...sans, ecouter: true }, new Set()).map((r) => r.id)).toEqual(["2", "3"]);
    expect(filtrerRessources(liste, { ...sans, favoris: true }, new Set(["3"])).map((r) => r.id)).toEqual(["3"]);
  });
  it("lit les filtres de l'adresse", () => {
    expect(lireFiltresRessources({ q: " sommeil ", categorie: CAT, ecouter: "1" })).toEqual({ q: "sommeil", categorie: CAT, ecouter: true, favoris: false });
    expect(lireFiltresRessources({ categorie: "n'importe quoi" }).categorie).toBeNull();
  });
  it("montre un extrait de la fiche autour du mot trouvé", () => {
    expect(extrait(liste[0].contenu, "legumes")).toMatch(/protéines et les légumes/);
    expect(extrait(liste[0].contenu, "absent")).toBeNull();
  });
});

describe("ressources : audios", () => {
  it("accepte m4a, mp3 et webm, refuse le reste", () => {
    expect(formatAudio("voix.m4a", "audio/x-m4a")).toEqual({ ext: "m4a", type: "audio/mp4" });
    expect(formatAudio("voix.M4A", "")).toEqual({ ext: "m4a", type: "audio/mp4" });
    expect(formatAudio("voix.mp3", "audio/mpeg")).toEqual({ ext: "mp3", type: "audio/mpeg" });
    expect(formatAudio("enregistrement", "audio/webm;codecs=opus")).toEqual({ ext: "webm", type: "audio/webm" });
    expect(formatAudio("photo.jpg", "image/jpeg")).toBeNull();
    expect(formatAudio("son.wav", "audio/wav")).toBeNull();
  });
  it("affiche les durées", () => {
    expect(dureeCourte(754)).toBe("13 min");
    expect(dureeCourte(20)).toBe("1 min");
    expect(dureeCourte(3725)).toBe("1 h 02");
    expect(dureeCourte(null)).toBeNull();
    expect(horloge(75)).toBe("1:15");
    expect(horloge(3725)).toBe("1:02:05");
  });
  it("reprend où elle s'est arrêtée, sauf si c'était fini", () => {
    expect(positionDeReprise({ position_s: 300, terminee: false }, 600)).toBe(300);
    expect(positionDeReprise({ position_s: 300, terminee: true }, 600)).toBe(0);
    expect(positionDeReprise({ position_s: 598, terminee: false }, 600)).toBe(0);
    expect(positionDeReprise({ position_s: 2, terminee: false }, 600)).toBe(0);
    expect(positionDeReprise(null, 600)).toBe(0);
    expect(estTerminee(595, 600)).toBe(true);
    expect(estTerminee(300, 600)).toBe(false);
  });
});
