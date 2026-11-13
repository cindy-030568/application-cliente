import { describe, expect, it } from "vitest";
import { cleRappel, emailRappel, personnaliser, rappelDu, type SituationRappel } from "./rappels";

// Début le 1er nov., bilan tous les 14 jours → échéance le 15 nov., ouverte 3 jours avant (le 12).
const base = (o: Partial<SituationRappel> = {}): SituationRappel => ({
  statut: "active",
  date_debut: "2026-11-02",
  frequence_bilan_jours: 14,
  fenetre: 3,
  relanceJours: 2,
  aujourdhui: "2026-11-12",
  bilansEnvoyes: new Set(),
  rappelsEnvoyes: new Map(),
  ...o,
});

describe("rappelDu", () => {
  it("rien tant que le bilan n'est pas ouvert", () => {
    expect(rappelDu(base({ aujourdhui: "2026-11-11" }))).toBeNull();
  });
  it("premier rappel le jour où le bilan s'ouvre", () => {
    expect(rappelDu(base())).toEqual({ echeance: "2026-11-15", type: "ouverture" });
  });
  it("pas deux fois le même rappel", () => {
    const envoyes = new Map([[cleRappel("2026-11-15", "ouverture"), "2026-11-12"]]);
    expect(rappelDu(base({ aujourdhui: "2026-11-13", rappelsEnvoyes: envoyes }))).toBeNull();
  });
  it("relance 2 jours après le premier rappel, une seule fois", () => {
    const envoyes = new Map([[cleRappel("2026-11-15", "ouverture"), "2026-11-12"]]);
    expect(rappelDu(base({ aujourdhui: "2026-11-14", rappelsEnvoyes: envoyes }))).toEqual({ echeance: "2026-11-15", type: "relance" });
    envoyes.set(cleRappel("2026-11-15", "relance"), "2026-11-14");
    expect(rappelDu(base({ aujourdhui: "2026-11-16", rappelsEnvoyes: envoyes }))).toBeNull();
  });
  it("pas de relance si la coach l'a désactivée", () => {
    const envoyes = new Map([[cleRappel("2026-11-15", "ouverture"), "2026-11-12"]]);
    expect(rappelDu(base({ aujourdhui: "2026-11-16", relanceJours: 0, rappelsEnvoyes: envoyes }))).toBeNull();
  });
  it("rien si le bilan est déjà envoyé", () => {
    expect(rappelDu(base({ bilansEnvoyes: new Set(["2026-11-15"]) }))).toBeNull();
  });
  it("rien pour une cliente en fin de suivi ou fermée", () => {
    expect(rappelDu(base({ statut: "terminee" }))).toBeNull();
    expect(rappelDu(base({ statut: "fermee" }))).toBeNull();
  });
  it("en retard mais encore rattrapable : premier rappel envoyé quand même", () => {
    expect(rappelDu(base({ aujourdhui: "2026-11-18" }))).toEqual({ echeance: "2026-11-15", type: "ouverture" });
  });
  it("plus rien une fois le bilan fermé", () => {
    const envoyes = new Map([[cleRappel("2026-11-15", "ouverture"), "2026-11-12"]]);
    expect(rappelDu(base({ aujourdhui: "2026-11-23", rappelsEnvoyes: envoyes }))).toBeNull();
  });
  it("sans date de début, aucun rappel", () => {
    expect(rappelDu(base({ date_debut: null }))).toBeNull();
  });
});

describe("textes", () => {
  it("personnalise le prénom", () => {
    expect(personnaliser("Coucou {prenom} !", "Léa")).toBe("Coucou Léa !");
    expect(personnaliser("Coucou {prenom} !", " ")).toBe("Coucou toi !");
  });
  it("l'email échappe le texte et contient le lien", () => {
    const { html, texte } = emailRappel("Hello <b>Léa</b> & co", "https://app.fr/suivi/bilan", "https://app.fr/profil");
    expect(html).toContain("Hello &lt;b&gt;Léa&lt;/b&gt; &amp; co");
    expect(html).toContain('href="https://app.fr/suivi/bilan"');
    expect(texte).toContain("https://app.fr/profil");
  });
});
