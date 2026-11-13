import { describe, expect, it } from "vitest";
import { ajouterMois, bilanPaiement, echeancesARecreer, etatEcheance, formaterEuros, genererEcheances, lireCentimes } from "./paiements";

describe("paiements", () => {
  it("lit les montants tapés à la française", () => {
    expect(lireCentimes("450")).toBe(45000);
    expect(lireCentimes("149,90")).toBe(14990);
    expect(lireCentimes("1 200 €")).toBe(120000);
    expect(lireCentimes("")).toBeNull();
    expect(Number.isNaN(lireCentimes("abc"))).toBe(true);
    expect(Number.isNaN(lireCentimes("12,345"))).toBe(true);
  });

  it("ajoute des mois sans déborder", () => {
    expect(ajouterMois("2026-09-07", 1)).toBe("2026-10-07");
    expect(ajouterMois("2026-01-31", 1)).toBe("2026-02-28");
    expect(ajouterMois("2028-01-31", 1)).toBe("2028-02-29");
    expect(ajouterMois("2026-11-15", 3)).toBe("2027-02-15");
  });

  it("crée un échéancier mensuel, les centimes en plus sur la 1re", () => {
    expect(genererEcheances(45000, 3, "2026-09-07")).toEqual([
      { date_echeance: "2026-09-07", montant: 150 },
      { date_echeance: "2026-10-07", montant: 150 },
      { date_echeance: "2026-11-07", montant: 150 },
    ]);
    const e = genererEcheances(10000, 3, "2026-09-07");
    expect(e.map((x) => x.montant)).toEqual([33.34, 33.33, 33.33]);
    expect(genererEcheances(29900, 1, "2026-09-07")).toEqual([{ date_echeance: "2026-09-07", montant: 299 }]);
  });

  it("garde les échéances payées et répartit le reste", () => {
    // 450 € en 3 fois, la 1re (150 €) payée → 2 × 150 € à partir du 2e mois
    expect(echeancesARecreer(45000, 3, "2026-09-07", [{ montant: 150 }])).toEqual([
      { date_echeance: "2026-10-07", montant: 150 },
      { date_echeance: "2026-11-07", montant: 150 },
    ]);
    // passage à 4 fois après une échéance payée → 3 × 100 €
    expect(echeancesARecreer(45000, 4, "2026-09-07", [{ montant: 150 }]).map((e) => e.montant)).toEqual([100, 100, 100]);
    // tout est payé
    expect(echeancesARecreer(45000, 3, "2026-09-07", [{ montant: 450 }])).toEqual([]);
  });

  it("état et totaux", () => {
    expect(etatEcheance({ date_echeance: "2026-11-07", payee_le: null }, "2026-11-13")).toBe("en_retard");
    expect(etatEcheance({ date_echeance: "2026-12-07", payee_le: null }, "2026-11-13")).toBe("a_venir");
    expect(etatEcheance({ date_echeance: "2026-11-07", payee_le: "2026-11-08" }, "2026-11-13")).toBe("payee");
    expect(bilanPaiement([{ montant: 150, payee_le: "2026-09-07" }, { montant: 150, payee_le: null }])).toEqual({ paye: 150, reste: 150 });
    expect(formaterEuros(150).replace(/\s/g, " ")).toBe("150 €");
    expect(formaterEuros(33.34).replace(/\s/g, " ")).toBe("33,34 €");
  });
});
