/**
 * Planning des repas de la semaine (logique pure, testée) : jours de la semaine,
 * et addition des quantités par aliment pour remplir la liste de courses.
 */
import { ajouterJours } from "./bilan";
import { lundiDe } from "./recap-semaine";

export { lundiDe };

/** Les 7 jours (lundi → dimanche) de la semaine qui commence ce lundi. */
export const joursSemaine = (lundi: string) => Array.from({ length: 7 }, (_, i) => ajouterJours(lundi, i));

/** Titre du lot de courses d'une semaine (sert aussi à le remplacer si on recommence). */
export const titreLotSemaine = (lundi: string) => `Planning de la semaine du ${lundi.slice(8, 10)}/${lundi.slice(5, 7)}`;

export type QuantitePlanifiee = { aliment_id: string; nom: string; unite: "g" | "unite"; nom_unite: string | null; quantite: number };

/** Additionne les quantités d'un même aliment (même unité) sur toute la semaine. */
export function additionner(lignes: QuantitePlanifiee[]): QuantitePlanifiee[] {
  const parAliment = new Map<string, QuantitePlanifiee>();
  for (const l of lignes) {
    if (!(l.quantite > 0)) continue;
    const cle = `${l.aliment_id}|${l.unite}`;
    const e = parAliment.get(cle);
    if (e) e.quantite += l.quantite;
    else parAliment.set(cle, { ...l });
  }
  return [...parAliment.values()].map((l) => ({ ...l, quantite: Math.round(l.quantite * 10) / 10 })).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}
