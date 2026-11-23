import { describe, expect, it } from "vitest";
import { CLE_FILE, CLE_PROPRIETAIRE, ajouterAFile, effacerHorsConnexion, fusionner, lireFile, ressourcesDePage, retirerDeFile, verifierProprietaire, type ElementFile } from "./hors-connexion";

function faux() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}
const seance = (id: string, ref: string): ElementFile => ({
  id,
  type: "seance",
  programmeId: "p1",
  seance: 0,
  nom: "Haut du corps",
  infos: { dureeMinutes: 45, ressenti: 3, commentaire: "" },
  ref,
  faiteLe: "2026-11-23T08:00:00.000Z",
});
const charges = (id: string, ref: string, lignes: { exercice: string; serie: number; kg: number }[]): ElementFile => ({ id, type: "charges", programmeId: "p1", ref, lignes });

describe("séance hors connexion : file d'attente", () => {
  it("une même séance n'est gardée qu'une fois", () => {
    const f = fusionner(fusionner([], seance("a", "r1")), seance("b", "r1"));
    expect(f).toHaveLength(1);
    expect(f[0].id).toBe("b");
  });
  it("les poids d'une même séance sont fusionnés, le dernier saisi l'emporte", () => {
    let f = fusionner([], charges("c1", "r1", [{ exercice: "Squat", serie: 1, kg: 20 }]));
    f = fusionner(f, charges("c2", "r1", [{ exercice: "Squat", serie: 1, kg: 22.5 }, { exercice: "Squat", serie: 2, kg: 22.5 }]));
    expect(f).toHaveLength(1);
    expect(f[0].type === "charges" && f[0].lignes).toEqual([
      { exercice: "Squat", serie: 1, kg: 22.5 },
      { exercice: "Squat", serie: 2, kg: 22.5 },
    ]);
  });
  it("ajout, lecture et retrait après envoi", () => {
    const s = faux();
    ajouterAFile(seance("a", "r1"), s);
    ajouterAFile(charges("c", "r1", [{ exercice: "Squat", serie: 1, kg: 20 }]), s);
    expect(lireFile(s)).toHaveLength(2);
    retirerDeFile(["a"], s);
    expect(lireFile(s).map((x) => x.id)).toEqual(["c"]);
    retirerDeFile(["c"], s);
    expect(s.m.has(CLE_FILE)).toBe(false);
  });
  it("un contenu abîmé ne casse rien", () => {
    const s = faux();
    s.setItem(CLE_FILE, "{pas du json");
    expect(lireFile(s)).toEqual([]);
  });
  it("effacé à la déconnexion, et si un autre compte se connecte", async () => {
    const s = faux();
    await verifierProprietaire("cliente-A", s);
    ajouterAFile(seance("a", "r1"), s);
    await verifierProprietaire("cliente-A", s);
    expect(lireFile(s)).toHaveLength(1);
    await verifierProprietaire("cliente-B", s);
    expect(lireFile(s)).toEqual([]);
    expect(s.getItem(CLE_PROPRIETAIRE)).toBe("cliente-B");
    ajouterAFile(seance("b", "r2"), s);
    await effacerHorsConnexion(s);
    expect(lireFile(s)).toEqual([]);
    expect(s.getItem(CLE_PROPRIETAIRE)).toBeNull();
  });
  it("repère les fichiers techniques d'une page à garder", () => {
    const html = '<link rel="stylesheet" href="/_next/static/css/a.css"/><script src="/_next/static/chunks/b.js" async></script><script src="https://ailleurs.fr/x.js"></script><img src="/photos/x.jpg">';
    expect(ressourcesDePage(html)).toEqual(["/_next/static/css/a.css", "/_next/static/chunks/b.js"]);
  });
});
