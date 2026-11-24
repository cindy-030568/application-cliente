import { describe, expect, it } from "vitest";
import { avantApres, bilanFinVisible, ecartSigne, evolutionMesures, lireOffres, progressionCharges } from "./bilan-fin";
import type { Bilan, ChampMesure } from "./types";

const champ = (id: string, libelle: string, est_poids = false): ChampMesure => ({
  id, groupe: "mesure", type: "nombre", libelle, unite: est_poids ? "kg" : "cm", aide: null, options: null, ordre: 0, actif: true, est_poids, section: "Mesures", avec_precision: false,
});
const bilan = (date: string, valeurs: Record<string, number>, photos: ("face" | "profil")[] = []): Bilan => ({
  id: date, cliente_id: "c", date_mesure: date, echeance: null, commentaire: null, saisi_par: null, envoye_le: `${date}T08:00:00Z`, modifie_le: null, retour: null,
  valeurs: Object.entries(valeurs).map(([champ_id, v]) => ({ champ_id, valeur_num: v, valeur_texte: null, precision: null })),
  photos: photos.map((angle) => ({ id: `${date}${angle}`, angle, fichier_path: `c/${date}/${angle}.jpg` })),
});
const CHAMPS = [champ("poids", "Poids", true), champ("taille", "Tour de taille"), champ("bras", "Tour de bras")];
const BILANS = [bilan("2026-10-01", { poids: 70, taille: 84, bras: 30 }, ["face"]), bilan("2026-11-20", { poids: 68.5, taille: 80.5 }, ["face", "profil"]), bilan("2026-10-20", { taille: 82 })];

describe("bilan de fin de suivi", () => {
  it("visible 7 jours avant la fin, ou si le suivi est terminé", () => {
    expect(bilanFinVisible({ statut: "active", date_fin: "2026-12-01" }, "2026-11-24")).toBe(true);
    expect(bilanFinVisible({ statut: "active", date_fin: "2026-12-02" }, "2026-11-24")).toBe(false);
    expect(bilanFinVisible({ statut: "active", date_fin: null }, "2026-11-24")).toBe(false);
    expect(bilanFinVisible({ statut: "terminee", date_fin: null }, "2026-11-24")).toBe(true);
    expect(bilanFinVisible({ statut: "fermee", date_fin: "2026-11-25" }, "2026-11-24")).toBe(false);
  });

  it("évolution des mesures (notées au moins 2 fois), dans l'ordre des dates", () => {
    const e = evolutionMesures(BILANS, CHAMPS, { sansChiffres: false, masquerPoids: false });
    expect(e.map((x) => [x.libelle, x.depart, x.actuel, x.ecart])).toEqual([
      ["Poids", 70, 68.5, -1.5],
      ["Tour de taille", 84, 80.5, -3.5],
    ]);
    expect(e[1].points.map((p) => p.valeur)).toEqual([84, 82, 80.5]);
  });

  it("poids masqué : jamais le poids ; sans chiffres : aucune mesure", () => {
    expect(evolutionMesures(BILANS, CHAMPS, { sansChiffres: false, masquerPoids: true }).map((x) => x.libelle)).toEqual(["Tour de taille"]);
    expect(evolutionMesures(BILANS, CHAMPS, { sansChiffres: true, masquerPoids: false })).toEqual([]);
  });

  it("photos avant / après : première et dernière photo du même angle", () => {
    expect(avantApres(BILANS)).toEqual({ avant: { date: "2026-10-01", chemin: "c/2026-10-01/face.jpg" }, apres: { date: "2026-11-20", chemin: "c/2026-11-20/face.jpg" } });
    expect(avantApres([BILANS[0]])).toBeNull();
  });

  it("progression des charges : première séance → meilleure charge", () => {
    const c = (nom: string, kg: number, jour: string) => ({ exercice_cle: nom, exercice_nom: nom, charge_kg: kg, jour });
    expect(progressionCharges([c("Squat", 20, "2026-10-01"), c("Squat", 22, "2026-10-01"), c("Squat", 35, "2026-11-20"), c("Rowing", 10, "2026-10-02"), c("Rowing", 10, "2026-11-01")])).toEqual([
      { nom: "Squat", depart: 22, meilleur: 35 },
    ]);
  });

  it("offres de la coach nettoyées", () => {
    expect(lireOffres([{ titre: " Programme 3 mois ", description: "On continue" }, { titre: "" }, "n'importe quoi"])).toEqual([{ titre: "Programme 3 mois", description: "On continue" }]);
    expect(lireOffres(null)).toEqual([]);
    expect(ecartSigne(-3.5)).toBe("−3,5");
    expect(ecartSigne(2)).toBe("+2");
  });
});
