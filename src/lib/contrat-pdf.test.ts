import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

vi.mock("server-only", () => ({}));
const { genererPreuveContrat } = await import("./contrat-pdf");

describe("preuve d'acceptation du contrat (PDF)", () => {
  it("produit un PDF lisible, même avec un long contrat et des caractères spéciaux", async () => {
    const pdf = await genererPreuveContrat({
      prenom: "Léa",
      nom: "Test",
      email: "lea@exemple.fr",
      version: "2026-12",
      accepteLe: "23 novembre 2026 à 10:42:05",
      texte: ("Article 1 – Objet : accompagnement « nutrition & sport » 💪.\n").repeat(200) + "motsansespacetreslong".repeat(30),
      texteRenonciation: "Je demande un début immédiat.",
      genereLe: "24 novembre 2026",
    });
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(doc.getTitle()).toContain("2026-12");
  });
});
