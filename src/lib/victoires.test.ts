import { describe, expect, it } from "vitest";
import { ajouterJours } from "./bilan";
import { detecterVictoires, type DonneesVictoires } from "./victoires";

const AUJ = "2026-11-26"; // jeudi
const base = (x: Partial<DonneesVictoires> = {}): DonneesVictoires => ({ prenom: "Léa", sansChiffres: false, charges: [], seances: [], journal: [], ...x });
const il = (n: number) => ajouterJours(AUJ, -n);
const charge = (nom: string, kg: number, jour: string) => ({ exercice_cle: nom.toLowerCase(), exercice_nom: nom, charge_kg: kg, jour });
const sansNombre = (t: string) => expect(t).not.toMatch(/\d/);

describe("victoires hors balance", () => {
  it("rien sans données", () => {
    expect(detecterVictoires(base(), AUJ)).toEqual([]);
  });

  it("record de charge : dépasse tout ce qui a été fait avant", () => {
    const v = detecterVictoires(base({ charges: [charge("Squat", 30, il(20)), charge("Squat", 35, il(10)), charge("Squat", 37.5, il(2))] }), AUJ);
    expect(v).toHaveLength(1);
    expect(v[0].type).toBe("record");
    expect(v[0].titre).toBe("Nouveau record : Squat à 37,5 kg !");
    expect(v[0].constat).toContain("avant 35 kg");
  });

  it("pas de record sans historique, ni si la charge égale l'ancien maximum", () => {
    expect(detecterVictoires(base({ charges: [charge("Squat", 40, il(1))] }), AUJ)).toEqual([]);
    expect(detecterVictoires(base({ charges: [charge("Squat", 40, il(10)), charge("Squat", 40, il(1))] }), AUJ)).toEqual([]);
  });

  it("plusieurs records regroupés en une victoire", () => {
    const v = detecterVictoires(
      base({ charges: [charge("Squat", 30, il(9)), charge("Squat", 32, il(1)), charge("Rowing", 10, il(9)), charge("Rowing", 12, il(3))] }),
      AUJ,
    );
    expect(v).toHaveLength(1);
    expect(v[0].titre).toMatch(/^2 nouveaux records cette semaine : (Squat et Rowing|Rowing et Squat) !$/);
  });

  it("régularité : fêtée dans la semaine où le cap est atteint", () => {
    // 3 semaines (lundis 9, 16 et 23 nov.) avec 2 séances chacune.
    const seances = ["2026-11-10", "2026-11-12", "2026-11-17", "2026-11-19", "2026-11-23", "2026-11-25"];
    const v = detecterVictoires(base({ seances }), AUJ);
    expect(v.map((x) => x.type)).toEqual(["regularite"]);
    expect(v[0].titre).toContain("3 semaines d’affilée");
    // Une seule séance cette semaine : pas encore.
    expect(detecterVictoires(base({ seances: seances.slice(0, 5) }), AUJ)).toEqual([]);
  });

  it("10e séance atteinte cette semaine", () => {
    const seances = Array.from({ length: 10 }, (_, i) => il(60 - i * 6));
    const v = detecterVictoires(base({ seances }), AUJ);
    expect(v.some((x) => x.cle === "seances-10")).toBe(true);
    expect(detecterVictoires(base({ seances: seances.slice(0, 9) }), AUJ).some((x) => x.type === "seances")).toBe(false);
  });

  it("tour de taille : −2 cm depuis le départ, fêté une seule fois par palier", () => {
    const journal = [80, 80, 80, 79, 78.5, 77.8].map((t, i) => ({ jour: il(50 - i * 10), tour_taille: t, stress: null, digestion: null }));
    // Dernière mesure il y a 0 jour : 77,8 (−2,2 cm) ; la précédente (78,5) n'avait pas franchi les 2 cm.
    const v = detecterVictoires(base({ journal }), AUJ);
    expect(v.map((x) => x.cle)).toEqual(["taille-2"]);
    expect(v[0].titre).toContain("−2 cm");
    // Le palier était déjà franchi la semaine d'avant : rien de nouveau.
    const deja = journal.map((j, i) => (i === 4 ? { ...j, tour_taille: 77.9 } : j));
    expect(detecterVictoires(base({ journal: deja }), AUJ)).toEqual([]);
  });

  it("moins de stress et meilleure digestion que les 3 semaines d'avant", () => {
    const journal = Array.from({ length: 28 }, (_, i) => ({
      jour: il(i),
      tour_taille: null,
      stress: i <= 6 ? 2 : 4,
      digestion: i <= 6 ? 4 : 3,
    }));
    const v = detecterVictoires(base({ journal }), AUJ);
    expect(v.map((x) => x.type).sort()).toEqual(["digestion", "stress"]);
  });

  it("le poids n'est jamais utilisé", () => {
    const journal = Array.from({ length: 28 }, (_, i) => ({ jour: il(i), tour_taille: null, stress: 3, digestion: 3, poids: 70 - i * 0.2 }));
    expect(detecterVictoires(base({ journal }), AUJ)).toEqual([]);
  });

  it("mode sans chiffres : aucun nombre dans ce que voit la cliente ni dans le message proposé", () => {
    const seances = ["2026-11-10", "2026-11-12", "2026-11-17", "2026-11-19", "2026-11-23", "2026-11-25", ...Array.from({ length: 4 }, (_, i) => il(40 + i))];
    const journal = [80, 80, 80, 79, 78.5, 75.8].map((t, i) => ({ jour: il(50 - i * 10), tour_taille: t, stress: null, digestion: null }));
    const charges = [charge("Squat", 30, il(9)), charge("Squat", 32, il(1)), charge("Rowing", 10, il(9)), charge("Rowing", 12, il(3))];
    const v = detecterVictoires(base({ sansChiffres: true, seances, journal, charges }), AUJ);
    expect(v.map((x) => x.type).sort()).toEqual(["record", "regularite", "seances", "taille"]);
    for (const x of v) {
      sansNombre(x.titre);
      sansNombre(x.message);
    }
    const un = detecterVictoires(base({ sansChiffres: true, charges: [charge("Squat", 30, il(9)), charge("Squat", 32, il(1))] }), AUJ)[0];
    sansNombre(un.titre);
    sansNombre(un.message);
  });
});

describe("victoire : défi du mois relevé", () => {
  const base = { prenom: "Léa", charges: [], seances: [], journal: [] };
  it("fête un défi réussi cette semaine, avec son titre", () => {
    const v = detecterVictoires({ ...base, sansChiffres: false, defis: [{ id: "d1", titre: "10 000 pas", jour: "2026-12-20" }] }, "2026-12-22");
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ type: "defi", cle: "defi-d1", titre: "Défi « 10 000 pas » relevé : bravo !" });
  });
  it("sans chiffres : pas le titre (il peut contenir des nombres)", () => {
    const v = detecterVictoires({ ...base, sansChiffres: true, defis: [{ id: "d1", titre: "10 000 pas", jour: "2026-12-20" }] }, "2026-12-22");
    expect(v[0].titre).not.toMatch(/\d/);
    expect(v[0].message).not.toMatch(/\d/);
  });
  it("plus après 7 jours", () => {
    expect(detecterVictoires({ ...base, sansChiffres: false, defis: [{ id: "d1", titre: "x", jour: "2026-12-01" }] }, "2026-12-22")).toHaveLength(0);
  });
});
