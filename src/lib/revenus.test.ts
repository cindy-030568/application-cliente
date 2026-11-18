import { describe, expect, it } from "vitest";
import { aEncaisser, csvEncaissements, encaissements, joursDeRetard, numeroterEcheances, synthese, type Mouvement } from "./revenus";

const m = (o: Partial<Mouvement> & Pick<Mouvement, "id" | "date_prevue" | "montant">): Mouvement => ({
  type: "echeance",
  cliente_id: "c1",
  cliente: "Léa Martin",
  formule: "Accompagnement 3 mois",
  libelle: "Échéance",
  payee_le: null,
  moyen: "virement",
  note: null,
  ...o,
});

const AUJ = "2026-11-18";
const mvts: Mouvement[] = [
  m({ id: "1", date_prevue: "2026-09-07", montant: 225, payee_le: "2026-09-07" }),
  m({ id: "2", date_prevue: "2026-10-07", montant: 112.5, payee_le: "2026-10-12" }),
  m({ id: "3", date_prevue: "2026-11-07", montant: 112.5 }), // en retard
  m({ id: "4", date_prevue: "2026-12-07", montant: 99.99, cliente: "Zoé", formule: null }), // à venir
  m({ id: "5", type: "divers", cliente_id: null, cliente: null, formule: null, libelle: "Atelier", date_prevue: "2026-11-02", montant: 45, payee_le: "2026-11-02", moyen: "carte" }),
  m({ id: "6", date_prevue: "2025-12-20", montant: 300, payee_le: "2025-12-20" }), // année passée
];

describe("synthese", () => {
  const s = synthese(mvts, 2026, AUJ);
  it("additionne l'encaissé de l'année et du mois", () => {
    expect(s.encaisseAnnee).toBe(382.5);
    expect(s.encaisseMois).toBe(45);
  });
  it("sépare retard et à venir", () => {
    expect(s.enRetard).toBe(112.5);
    expect(s.nbEnRetard).toBe(1);
    expect(s.aVenir).toBe(99.99);
    expect(s.nbAVenir).toBe(1);
  });
  it("répartit par mois : encaissé à la date réelle, prévu à la date prévue", () => {
    expect(s.parMois[9]).toEqual({ mois: 10, encaisse: 112.5, prevu: 112.5 });
    expect(s.parMois[10]).toEqual({ mois: 11, encaisse: 45, prevu: 157.5 });
    expect(s.prevuAnnee).toBe(594.99);
  });
  it("classe par formule et par moyen", () => {
    expect(s.parFormule[0]).toEqual({ formule: "Accompagnement 3 mois", montant: 337.5 });
    expect(s.parFormule[1]).toEqual({ formule: "Hors accompagnement", montant: 45 });
    expect(s.parMoyen.find((x) => x.moyen === "Carte bancaire")?.montant).toBe(45);
  });
  it("calcule la moyenne sur les mois écoulés", () => {
    expect(s.moyenneMensuelle).toBe(34.77); // 382,50 / 11
    expect(synthese(mvts, 2025, AUJ).moyenneMensuelle).toBe(25); // 300 / 12
  });
});

describe("listes", () => {
  it("à encaisser : du plus ancien au plus récent", () => {
    expect(aEncaisser(mvts).map((x) => x.id)).toEqual(["3", "4"]);
  });
  it("encaissements de l'année, filtrables par mois", () => {
    expect(encaissements(mvts, 2026).map((x) => x.id)).toEqual(["5", "2", "1"]);
    expect(encaissements(mvts, 2026, 10).map((x) => x.id)).toEqual(["2"]);
  });
  it("numérote les échéances de chaque cliente", () => {
    const n = numeroterEcheances([
      { id: "b", cliente_id: "x", date_echeance: "2026-02-01" },
      { id: "a", cliente_id: "x", date_echeance: "2026-01-01" },
      { id: "z", cliente_id: "y", date_echeance: "2026-01-01" },
    ]);
    expect(n.get("a")).toBe("Échéance 1/2");
    expect(n.get("b")).toBe("Échéance 2/2");
    expect(n.get("z")).toBe("Paiement");
  });
  it("compte les jours de retard", () => {
    expect(joursDeRetard(mvts[2], AUJ)).toBe(11);
    expect(joursDeRetard(mvts[3], AUJ)).toBe(0);
  });
});

describe("export", () => {
  it("produit un CSV pour Excel avec le total", () => {
    const csv = csvEncaissements(mvts, 2026);
    const lignes = csv.split("\r\n");
    expect(lignes[0]).toMatch(/^﻿Date d'encaissement;Cliente/);
    expect(lignes[1]).toBe("07/09/2026;Léa Martin;Accompagnement 3 mois;Échéance;225,00;Virement;07/09/2026;");
    expect(lignes.at(-1)).toBe(";;;Total;382,50;;;");
  });
});
