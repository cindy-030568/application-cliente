import { describe, expect, it } from "vitest";
import { lireFiche, morceaux } from "./fiche";

describe("fiche écrite dans l'appli", () => {
  it("intertitres, paragraphes et listes", () => {
    const b = lireFiche("Intro sur\ndeux lignes.\n\n## Au restaurant\n- **Choisis** ce qui te plaît\n- Bois de l'eau\nUn paragraphe après.");
    expect(b.map((x) => x.type)).toEqual(["paragraphe", "titre", "liste", "paragraphe"]);
    expect(b[0]).toEqual({ type: "paragraphe", morceaux: [{ texte: "Intro sur deux lignes.", gras: false }] });
    expect(b[2]).toEqual({
      type: "liste",
      elements: [
        [{ texte: "Choisis", gras: true }, { texte: " ce qui te plaît", gras: false }],
        [{ texte: "Bois de l'eau", gras: false }],
      ],
    });
  });

  it("le HTML reste du texte, et un ** isolé aussi", () => {
    expect(morceaux("<b>non</b> 2 ** 3")).toEqual([{ texte: "<b>non</b> 2 ** 3", gras: false }]);
  });
});
