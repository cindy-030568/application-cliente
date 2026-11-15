import { describe, expect, it } from "vitest";
import { masquerIdentite, texteBilanPourClaude } from "./bilan-claude";
import type { Bilan, ChampMesure } from "./types";

const champ = (id: string, o: Partial<ChampMesure>): ChampMesure => ({
  id, groupe: "mesure", type: "nombre", libelle: id, unite: null, aide: null, options: null,
  ordre: 1, actif: true, est_poids: false, section: "Mesures", avec_precision: false, ...o,
});
const bilan = (date: string, valeurs: Bilan["valeurs"], commentaire: string | null = null): Bilan => ({
  id: date, cliente_id: "c", date_mesure: date, echeance: date, commentaire, saisi_par: null,
  envoye_le: date, modifie_le: null, valeurs, photos: [], retour: null,
});

describe("bilan pour Claude", () => {
  it("masque le prénom et le nom, mots entiers seulement", () => {
    expect(masquerIdentite("Merci Léa ! léa est contente. Léandre non.", ["Léa", "Martin"])).toBe(
      "Merci [prénom] ! [prénom] est contente. Léandre non.",
    );
  });

  it("résume le bilan sans nom ni date, avec les écarts", () => {
    const champs = [
      champ("poids", { libelle: "Poids", unite: "kg", ordre: 1 }),
      champ("energie", { libelle: "Énergie", type: "echelle", groupe: "ressenti", section: "Ressentis", ordre: 2, avec_precision: true }),
    ];
    const precedent = bilan("2026-10-18", [{ champ_id: "poids", valeur_num: 64.2, valeur_texte: null, precision: null }]);
    const actuel = bilan(
      "2026-11-01",
      [
        { champ_id: "poids", valeur_num: 63.4, valeur_texte: null, precision: null },
        { champ_id: "energie", valeur_num: 7, valeur_texte: null, precision: "Mieux depuis que Léa dort plus" },
      ],
      "Coucou Cindy, c'est Léa Martin, dur le week-end",
    );
    const t = texteBilanPourClaude({ bilan: actuel, precedent, champs, jours: 14, dateDebut: "2026-09-07", identite: ["Léa", "Martin"], avecPhotos: false });
    expect(t).toContain("semaine 8 de l’accompagnement");
    expect(t).toContain("- Poids : 63,4 kg (-0,8 kg depuis le bilan précédent)");
    expect(t).toContain("- Énergie : 7/10 — précision : « Mieux depuis que [prénom] dort plus »");
    expect(t).toContain("c'est [prénom] [prénom], dur le week-end");
    expect(t).not.toMatch(/Léa|Martin|2026/);
  });
});
