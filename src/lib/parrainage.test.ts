import { describe, expect, it } from "vitest";
import { csvAvis, lienParrainage, lireCode, nomPublic } from "./parrainage";

describe("parrainage", () => {
  it("lit un code tapé à la main ou venu du lien", () => {
    expect(lireCode(" ab c2-3d ")).toBe("ABC23D");
    expect(lireCode("ABC")).toBeNull();
    expect(lireCode(null)).toBeNull();
  });
  it("lien personnel vers le formulaire d'inscription", () => {
    expect(lienParrainage("https://tally.so/r/EkdN0A", "ABC23D")).toBe("https://tally.so/r/EkdN0A?parrain=ABC23D");
    expect(lienParrainage("https://tally.so/r/EkdN0A?x=1", "ABC23D")).toBe("https://tally.so/r/EkdN0A?x=1&parrain=ABC23D");
    expect(lienParrainage("http://pas-sur.fr", "ABC23D")).toBeNull();
    expect(lienParrainage(null, "ABC23D")).toBeNull();
  });
});

describe("avis", () => {
  it("publié seulement si elle l'a autorisé, sous le nom choisi", () => {
    expect(nomPublic({ publiable: false, nom_affiche: "prenom" }, "Léa")).toBeNull();
    expect(nomPublic({ publiable: true, nom_affiche: "prenom" }, "Léa")).toBe("Léa");
    expect(nomPublic({ publiable: true, nom_affiche: "initiale" }, "léa")).toBe("L.");
    expect(nomPublic({ publiable: true, nom_affiche: "anonyme" }, "Léa")).toBe("Une cliente de Cindy");
  });
  it("export CSV pour Excel", () => {
    const csv = csvAvis([{ cree_le: "2026-11-24T10:00:00Z", prenom: "Léa", nom: "Martin", texte: 'Merci "Cindy" ; top', publiable: true, nom_affiche: "initiale", contexte: "fin" }]);
    expect(csv.startsWith("﻿Date;Cliente;Publication autorisée")).toBe(true);
    expect(csv).toContain('2026-11-24;Léa Martin;Oui;L.;Fin de suivi;"Merci ""Cindy"" ; top"');
  });
});
