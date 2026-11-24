/**
 * Fiche écrite dans l'appli (logique pure, testée) : un format très simple que la coach tape à la main.
 * - « ## Titre » : un intertitre ;
 * - « - texte » : une ligne de liste ;
 * - une ligne vide sépare les paragraphes ;
 * - **texte** : en gras.
 * Aucun HTML n'est interprété (le texte est affiché tel quel, sans risque).
 */

export type Morceau = { texte: string; gras: boolean };
export type Bloc = { type: "titre"; morceaux: Morceau[] } | { type: "paragraphe"; morceaux: Morceau[] } | { type: "liste"; elements: Morceau[][] };

/** « un **mot** en gras » → morceaux normaux et gras. */
export function morceaux(ligne: string): Morceau[] {
  const sortie: Morceau[] = [];
  const parties = ligne.split("**");
  // Un « ** » sans partenaire reste du texte.
  if (parties.length % 2 === 0) return [{ texte: ligne, gras: false }];
  parties.forEach((p, i) => {
    if (p) sortie.push({ texte: p, gras: i % 2 === 1 });
  });
  return sortie;
}

export function lireFiche(contenu: string): Bloc[] {
  const blocs: Bloc[] = [];
  let paragraphe: string[] = [];
  let liste: Morceau[][] = [];
  const fermer = () => {
    if (paragraphe.length) blocs.push({ type: "paragraphe", morceaux: morceaux(paragraphe.join(" ")) });
    if (liste.length) blocs.push({ type: "liste", elements: liste });
    paragraphe = [];
    liste = [];
  };
  for (const brute of contenu.replace(/\r\n?/g, "\n").split("\n")) {
    const ligne = brute.trim();
    if (!ligne) {
      fermer();
    } else if (/^#{1,3}\s+/.test(ligne)) {
      fermer();
      blocs.push({ type: "titre", morceaux: morceaux(ligne.replace(/^#{1,3}\s+/, "")) });
    } else if (/^[-•*]\s+/.test(ligne)) {
      if (paragraphe.length) {
        blocs.push({ type: "paragraphe", morceaux: morceaux(paragraphe.join(" ")) });
        paragraphe = [];
      }
      liste.push(morceaux(ligne.replace(/^[-•*]\s+/, "")));
    } else {
      if (liste.length) {
        blocs.push({ type: "liste", elements: liste });
        liste = [];
      }
      paragraphe.push(ligne);
    }
  }
  fermer();
  return blocs;
}
