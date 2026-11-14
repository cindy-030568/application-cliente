/**
 * Noms d'aliments lisibles dans les recettes.
 * Les noms Ciqual sont très détaillés (« Tomate, pulpe, appertisée », « Cumin, graine »,
 * « Persil, frais ») : on garde le nom de l'aliment et seulement l'indication cru / cuit.
 */

/** Noms réécrits à la main quand la règle générale donnerait un résultat maladroit. */
const NOMS_PREFERES: Record<string, string> = {
  "oeuf, blanc (blanc d'oeuf), cru": "Blanc d'œuf",
  "oeuf, cru": "Œuf",
  "poulet, filet, sans peau, cru": "Filet de poulet cru",
  "dinde, escalope, crue": "Escalope de dinde crue",
  "boeuf, steak haché 5% mg, cru": "Steak haché 5 % cru",
  "emmental ou emmenthal râpé": "Emmental râpé",
  "pain complet ou intégral (à la farine t150)": "Pain complet",
  "fromage blanc nature, 0% mg": "Fromage blanc 0 %",
  "crème de lait, 15 à 20% mg, légère, fluide, rayon frais": "Crème légère",
  "thon, au naturel, appertisé, égoutté": "Thon au naturel",
  "chocolat noir à 70% cacao minimum, extra, dégustation, tablette": "Chocolat noir 70 %",
  "lentille corail, sèche": "Lentille corail crue",
  "lentille verte, sèche": "Lentille verte crue",
  "champignon de paris ou champignon de couche, cru": "Champignon de Paris cru",
  "pomme de terre, sans peau, crue": "Pomme de terre crue",
  "fromage de chèvre frais, au lait pasteurisé ou cru (type crottin frais ou bûchette fraîche)": "Fromage de chèvre frais",
};

/** Indication cru / cuit (avec ses accords : crue, crus, cuites…). */
const CUISSON = /^(crue?s?|cuite?s?)$/i;

export function nomIngredient(nom: string): string {
  const prefere = NOMS_PREFERES[nom.trim().toLowerCase().replace(/œ/g, "oe")];
  if (prefere) return prefere;
  const sansParentheses = nom.replace(/\s*\(.*?\)/g, "").trim();
  const morceaux = sansParentheses.split(",").map((m) => m.trim()).filter(Boolean);
  if (!morceaux.length) return nom;
  // « Lait de coco ou Crème de coco » → « Lait de coco » (une seule appellation).
  const principal = morceaux[0].replace(/\s+ou\s+[A-ZÀ-Ý].*$/, "").replace(/\boeuf\b/gi, (m) => (m[0] === "O" ? "Œuf" : "œuf"));
  const cuisson = morceaux.slice(1).find((m) => CUISSON.test(m));
  return cuisson ? `${principal} ${cuisson.toLowerCase()}` : principal;
}
