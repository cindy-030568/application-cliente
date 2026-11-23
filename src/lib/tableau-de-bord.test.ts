import { describe, expect, it } from "vitest";
import { classerTaches, enRetard, quand, resume, type Tache } from "./tableau-de-bord";

const AUJ = "2026-11-23";
const t = (id: string, type: Tache["type"], date: string): Tache => ({ id, type, date, titre: id, detail: "", lien: "/" });

describe("agenda de la coach", () => {
  const taches = [
    t("paiement-retard", "paiement", "2026-11-20"),
    t("bilan-recu-hier", "bilan_recu", "2026-11-22"),
    t("bilan-recu-vieux", "bilan_recu", "2026-11-18"),
    t("paiement-jour", "paiement", "2026-11-23"),
    t("programme-3j", "programme", "2026-11-26"),
    t("bilan-prevu-demain", "bilan_prevu", "2026-11-24"),
    t("auto-10j", "programme_auto", "2026-12-03"),
    t("fin-20j", "fin_suivi", "2026-12-13"),
    t("bilan-prevu-passe", "bilan_prevu", "2026-11-21"),
    t("signalement", "signalement", "2026-11-23"),
    t("manquant", "bilan_manquant", "2026-11-19"),
  ];
  const a = classerTaches(taches, AUJ);

  it("range par urgence", () => {
    expect(a.maintenant.map((x) => x.id)).toEqual([
      "bilan-recu-vieux",
      "manquant",
      "paiement-retard",
      "bilan-recu-hier",
      "signalement",
      "paiement-jour",
    ]);
    expect(a.semaine.map((x) => x.id)).toEqual(["bilan-prevu-demain", "programme-3j"]);
    expect(a.plusTard.map((x) => x.id)).toEqual(["auto-10j"]);
  });
  it("compte les retards (pas les simples informations)", () => {
    expect(a.enRetard).toBe(3);
    expect(enRetard(t("x", "bilan_recu", "2026-11-22"), AUJ)).toBe(false);
    expect(enRetard(t("x", "programme_auto", "2026-11-20"), AUJ)).toBe(false);
  });
  it("dit quand", () => {
    expect(quand(t("x", "paiement", "2026-11-20"), AUJ)).toBe("en retard de 3 j");
    expect(quand(t("x", "paiement", "2026-11-23"), AUJ)).toBe("aujourd’hui");
    expect(quand(t("x", "programme", "2026-11-24"), AUJ)).toBe("demain");
    expect(quand(t("x", "programme", "2026-11-26"), AUJ)).toBe("jeudi 26 nov.");
    expect(quand(t("x", "bilan_recu", "2026-11-22"), AUJ)).toBe("reçu hier");
    expect(quand(t("x", "bilan_manquant", "2026-11-19"), AUJ)).toBe("attendu depuis 4 j");
  });
  it("phrase d'accueil", () => {
    expect(resume(a)).toBe("6 choses à faire aujourd’hui, dont 3 en retard.");
    expect(resume(classerTaches([], AUJ))).toBe("Rien d’urgent : tout est à jour. 🎉");
    expect(resume(classerTaches([t("p", "programme", "2026-11-25")], AUJ))).toBe("Rien d’urgent aujourd’hui. Voici ce qui arrive cette semaine.");
  });
});

describe("notes à lire vite", () => {
  it("en tête de « maintenant », jamais « en retard »", () => {
    const auj = "2026-11-23";
    const agenda = classerTaches(
      [
        { id: "p", type: "paiement", date: "2026-11-23", titre: "A", detail: "", lien: "" },
        { id: "n", type: "note", date: "2026-11-22", titre: "B", detail: "", lien: "" },
      ],
      auj,
    );
    expect(agenda.maintenant.map((t) => t.id)).toEqual(["n", "p"]);
    expect(agenda.enRetard).toBe(0);
    expect(quand(agenda.maintenant[0], auj)).toBe("écrit hier");
  });
});
