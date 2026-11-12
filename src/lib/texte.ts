/** Texte sans accents ni majuscules (recherche). */
export function normaliser(texte: string): string {
  return texte
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "oe")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
