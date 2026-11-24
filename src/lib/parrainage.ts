/**
 * Parrainage et avis (logique pure, testée).
 * - Chaque cliente a un code personnel de 6 caractères et un lien vers le formulaire d'inscription
 *   (« ?parrain=CODE » remplit tout seul la question « Code de parrainage » dans Tally).
 * - Un avis peut être publié seulement si la cliente l'a autorisé, sous le nom qu'elle a choisi.
 */

/** Code tapé ou reçu (« ab c2 3d » → « ABC23D »), ou null s'il n'a pas la bonne forme. */
export function lireCode(brut: string | null | undefined): string | null {
  const c = String(brut ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z0-9]{6}$/.test(c) ? c : null;
}

/** Lien personnel : le formulaire d'inscription avec le code de la marraine. */
export function lienParrainage(lienInscription: string | null | undefined, code: string): string | null {
  if (!lienInscription) return null;
  try {
    const u = new URL(lienInscription);
    if (u.protocol !== "https:") return null;
    u.searchParams.set("parrain", code);
    return u.toString();
  } catch {
    return null;
  }
}

export type NomAffiche = "prenom" | "initiale" | "anonyme";
export const LIBELLE_NOM_AFFICHE: Record<NomAffiche, string> = {
  prenom: "Mon prénom",
  initiale: "Mon initiale",
  anonyme: "Anonyme",
};

/** Nom sous lequel la coach peut publier l'avis (null si la publication n'est pas autorisée). */
export function nomPublic(a: { publiable: boolean; nom_affiche: NomAffiche | null }, prenom: string): string | null {
  if (!a.publiable || !a.nom_affiche) return null;
  const p = prenom.trim();
  if (a.nom_affiche === "prenom" && p) return p;
  if (a.nom_affiche === "initiale" && p) return `${p[0].toUpperCase()}.`;
  return "Une cliente de Cindy";
}

const cellule = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Export des avis (CSV au point-virgule, lisible par Excel en français). */
export function csvAvis(
  avis: { cree_le: string; prenom: string; nom: string; texte: string; publiable: boolean; nom_affiche: NomAffiche | null; contexte: string }[],
): string {
  const entete = ["Date", "Cliente", "Publication autorisée", "Nom à afficher", "Moment", "Témoignage"];
  const moment: Record<string, string> = { victoire: "Après une victoire", fin: "Fin de suivi", libre: "Libre" };
  const lignes = avis.map((a) => [
    a.cree_le.slice(0, 10),
    `${a.prenom} ${a.nom}`.trim(),
    a.publiable ? "Oui" : "Non",
    nomPublic(a, a.prenom) ?? "",
    moment[a.contexte] ?? a.contexte,
    a.texte.replace(/\r\n?/g, "\n"),
  ]);
  return `﻿${[entete, ...lignes].map((l) => l.map(cellule).join(";")).join("\r\n")}\r\n`;
}
