import { describe, expect, it } from "vitest";
import { formaterDate, joursEntre, prochainBilan } from "./bilan";

describe("prochainBilan", () => {
  it("premier bilan 14 jours après le début", () => {
    expect(prochainBilan("2026-11-01", 14, "2026-11-01")).toBe("2026-11-15");
    expect(prochainBilan("2026-11-01", 14, "2026-11-05")).toBe("2026-11-15");
  });
  it("le jour du bilan, c'est aujourd'hui", () => {
    expect(prochainBilan("2026-11-01", 14, "2026-11-15")).toBe("2026-11-15");
  });
  it("le lendemain d'un bilan, on passe au suivant", () => {
    expect(prochainBilan("2026-11-01", 14, "2026-11-16")).toBe("2026-11-29");
  });
  it("début dans le futur", () => {
    expect(prochainBilan("2026-12-01", 7, "2026-11-09")).toBe("2026-12-08");
  });
  it("traverse les changements d'heure et d'année", () => {
    expect(prochainBilan("2026-12-20", 14, "2027-01-02")).toBe("2027-01-03");
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
