import { describe, expect, it } from "vitest";
import {
  bilanAvecPhotos,
  premiereEcheance,
  alertesCliente,
  conservationDepassee,
  derniereEcheancePassee,
  echeanceOuverte,
  echeancesPassees,
  formaterDate,
  heureParisVersIso,
  isoVersHeureParis,
  joursEntre,
  prochainBilan,
} from "./bilan";

describe("prochainBilan", () => {
  it("premier bilan 14 jours après le début", () => {
    expect(prochainBilan("2026-11-02", 14, "2026-11-01")).toBe("2026-11-15");
    expect(prochainBilan("2026-11-02", 14, "2026-11-05")).toBe("2026-11-15");
  });
  it("le jour du bilan, c'est aujourd'hui", () => {
    expect(prochainBilan("2026-11-02", 14, "2026-11-15")).toBe("2026-11-15");
  });
  it("le lendemain d'un bilan, on passe au suivant", () => {
    expect(prochainBilan("2026-11-02", 14, "2026-11-16")).toBe("2026-11-29");
  });
  it("début dans le futur", () => {
    expect(prochainBilan("2026-12-01", 7, "2026-11-09")).toBe("2026-12-07");
  });
  it("traverse les changements d'heure et d'année", () => {
    expect(prochainBilan("2026-12-21", 14, "2027-01-02")).toBe("2027-01-03");
  });
  it("sans date de début : pas de bilan", () => {
    expect(prochainBilan(null, 14, "2026-11-09")).toBeNull();
  });
});

describe("utilitaires de date", () => {
  it("joursEntre", () => {
    expect(joursEntre("2026-11-09", "2026-11-15")).toBe(6);
  });
  it("formaterDate en français", () => {
    expect(formaterDate("2026-11-09")).toBe("9 novembre 2026");
  });
});


describe("echeanceOuverte (début le 2 nov., bilan tous les 14 jours, fenêtre de 3 jours)", () => {
  const ouv = (auj: string) => echeanceOuverte("2026-11-02", 14, 3, auj);
  it("fermé tant qu'on n'est pas à 3 jours de l'échéance", () => {
    expect(ouv("2026-11-05")).toBeNull();
    expect(ouv("2026-11-11")).toBeNull();
  });
  it("s'ouvre 3 jours avant l'échéance du 15", () => {
    expect(ouv("2026-11-12")).toEqual({ echeance: "2026-11-15", statut: "ouverte", fermeLe: "2026-11-22" });
  });
  it("ouvert le jour même", () => {
    expect(ouv("2026-11-15")?.statut).toBe("ouverte");
  });
  it("en retard mais rattrapable jusqu'à 7 jours après", () => {
    expect(ouv("2026-11-16")).toEqual({ echeance: "2026-11-15", statut: "en_retard", fermeLe: "2026-11-22" });
    expect(ouv("2026-11-22")?.echeance).toBe("2026-11-15");
  });
  it("puis fermé jusqu'à la fenêtre suivante", () => {
    expect(ouv("2026-11-23")).toBeNull();
    expect(ouv("2026-11-26")?.echeance).toBe("2026-11-29");
  });
  it("sans date de début : jamais ouvert", () => {
    expect(echeanceOuverte(null, 14, 3, "2026-11-12")).toBeNull();
  });
  it("fenêtre de 0 jour : seulement le jour J (puis rattrapage)", () => {
    expect(echeanceOuverte("2026-11-02", 7, 0, "2026-11-07")).toBeNull();
    expect(echeanceOuverte("2026-11-02", 7, 0, "2026-11-08")?.statut).toBe("ouverte");
  });
});

describe("échéances passées", () => {
  it("aucune avant le premier bilan", () => {
    expect(derniereEcheancePassee("2026-11-02", 14, "2026-11-15")).toBeNull();
  });
  it("la dernière échéance strictement passée", () => {
    expect(derniereEcheancePassee("2026-11-02", 14, "2026-11-16")).toBe("2026-11-15");
    expect(derniereEcheancePassee("2026-11-02", 14, "2026-11-29")).toBe("2026-11-15");
  });
  it("les deux dernières", () => {
    expect(echeancesPassees("2026-11-02", 14, "2026-12-01", 2)).toEqual(["2026-11-29", "2026-11-15"]);
  });
});

describe("alertesCliente", () => {
  const base = {
    statut: "active",
    date_debut: "2026-10-02",
    date_fin: null as string | null,
    frequence_bilan_jours: 14,
    derniere_visite: "2026-11-10T08:00:00Z" as string | null,
    created_at: "2026-10-01T08:00:00Z",
  };
  it("rien à signaler quand tout est à jour", () => {
    expect(alertesCliente(base, new Set(["2026-10-29", "2026-10-15"]), "2026-11-11")).toEqual([]);
  });
  it("bilan manquant avec son retard", () => {
    expect(alertesCliente(base, new Set(["2026-10-15"]), "2026-11-11")).toEqual([
      { type: "bilan_manquant", echeance: "2026-10-29", retard: 13 },
    ]);
  });
  it("décrochage : deux bilans manqués d'affilée", () => {
    const a = alertesCliente(base, new Set(), "2026-11-11");
    expect(a.map((x) => x.type)).toEqual(["bilan_manquant", "decrochage_bilans"]);
  });
  it("décrochage : pas de visite depuis 10 jours", () => {
    const a = alertesCliente({ ...base, derniere_visite: "2026-10-30T08:00:00Z" }, new Set(["2026-10-29", "2026-10-15"]), "2026-11-11");
    expect(a).toEqual([{ type: "decrochage_visite", jours: 12 }]);
  });
  it("fin de suivi dans 15 jours ou moins", () => {
    const a = alertesCliente({ ...base, date_fin: "2026-11-20" }, new Set(["2026-10-29", "2026-10-15"]), "2026-11-11");
    expect(a).toEqual([{ type: "fin_suivi", dateFin: "2026-11-20", jours: 9 }]);
  });
  it("aucune alerte pour une cliente au suivi terminé", () => {
    expect(alertesCliente({ ...base, statut: "terminee" }, new Set(), "2026-11-11")).toEqual([]);
  });
});


describe("heure de Paris", () => {
  it("hiver (UTC+1)", () => {
    expect(heureParisVersIso("2026-11-20T18:30")).toBe("2026-11-20T17:30:00.000Z");
  });
  it("été (UTC+2)", () => {
    expect(heureParisVersIso("2026-07-01T09:00")).toBe("2026-07-01T07:00:00.000Z");
  });
  it("aller-retour", () => {
    expect(isoVersHeureParis("2026-11-20T17:30:00.000Z")).toBe("2026-11-20T18:30");
  });
  it("valeur invalide", () => {
    expect(heureParisVersIso("demain")).toBeNull();
  });
});

describe("conservationDepassee", () => {
  it("3 ans après la fermeture de l'accès, jour pour jour", () => {
    expect(conservationDepassee("fermee", "2026-11-13T10:00:00Z", "2029-11-12")).toBe(false);
    expect(conservationDepassee("fermee", "2026-11-13T10:00:00Z", "2029-11-13")).toBe(true);
  });
  it("jamais pour une cliente active ou en fin de suivi", () => {
    expect(conservationDepassee("active", "2020-01-01", "2029-11-13")).toBe(false);
    expect(conservationDepassee("terminee", "2020-01-01", "2029-11-13")).toBe(false);
    expect(conservationDepassee("fermee", null, "2029-11-13")).toBe(false);
  });
});

describe("bilanAvecPhotos (photos de suivi toutes les 4 semaines)", () => {
  it("bilan tous les 14 jours : un sur deux, à 4, 8, 12 semaines", () => {
    const debut = "2026-11-02";
    expect(bilanAvecPhotos(debut, 14, "2026-11-15")).toBe(false);
    expect(bilanAvecPhotos(debut, 14, "2026-11-29")).toBe(true);
    expect(bilanAvecPhotos(debut, 14, "2026-12-13")).toBe(false);
    expect(bilanAvecPhotos(debut, 14, "2026-12-27")).toBe(true);
  });
  it("bilan toutes les semaines : un sur quatre", () => {
    const r = [7, 14, 21, 28, 35, 42, 49, 56].map((j) => bilanAvecPhotos("2026-11-02", 7, `2026-${j < 30 ? "11" : "12"}-${String(j < 30 ? 1 + j : j - 29).padStart(2, "0")}`));
    expect(r).toEqual([false, false, false, true, false, false, false, true]);
  });
  it("bilan tous les 30 jours : à chaque bilan", () => {
    expect(bilanAvecPhotos("2026-11-02", 30, "2026-12-01")).toBe(true);
  });
  it("sans date de début : jamais", () => {
    expect(bilanAvecPhotos(null, 14, "2026-11-15")).toBe(false);
  });
});

describe("comptage comme dans un tableau (le jour du démarrage = jour 1)", () => {
  it("démarrage le lundi 7 sept., toutes les 2 semaines : 20/09, 04/10, 18/10, 01/11, 15/11", () => {
    expect(premiereEcheance("2026-09-07", 14)).toBe("2026-09-20");
    expect(echeancesPassees("2026-09-07", 14, "2026-11-13", 4)).toEqual(["2026-11-01", "2026-10-18", "2026-10-04", "2026-09-20"]);
    expect(prochainBilan("2026-09-07", 14, "2026-11-13")).toBe("2026-11-15");
    expect(bilanAvecPhotos("2026-09-07", 14, "2026-11-15")).toBe(false);
    expect(bilanAvecPhotos("2026-09-07", 14, "2026-11-29")).toBe(true);
  });
});
