/**
 * Bilan de fin de suivi (logique pure, testée) : quand le montrer, l'évolution des mesures,
 * la progression des charges et les offres « continuer avec moi » de la coach.
 * Mode sans chiffres : aucune mesure ni photo ; poids masqué : jamais le poids.
 */
import { joursEntre } from "./bilan";
import type { Bilan, ChampMesure } from "./types";

/** Visible 7 jours avant la date de fin, ou dès que le suivi est « terminé » (jusqu'à la fermeture de l'accès). */
export function bilanFinVisible(f: { statut: string; date_fin: string | null }, aujourdhui: string): boolean {
  if (f.statut === "terminee") return true;
  return f.statut === "active" && Boolean(f.date_fin) && joursEntre(aujourdhui, f.date_fin!) <= 7;
}

export type Evolution = { libelle: string; unite: string | null; depart: number; actuel: number; ecart: number; points: { date: string; valeur: number }[] };

/** Mesures notées au moins 2 fois : départ, actuel, écart, et les points pour la courbe. */
export function evolutionMesures(bilans: Bilan[], champs: ChampMesure[], o: { sansChiffres: boolean; masquerPoids: boolean }): Evolution[] {
  if (o.sansChiffres) return [];
  const chrono = [...bilans].sort((a, b) => a.date_mesure.localeCompare(b.date_mesure));
  return champs
    .filter((c) => c.groupe === "mesure" && c.type === "nombre" && !(o.masquerPoids && c.est_poids))
    .flatMap((c) => {
      const points = chrono.flatMap((b) => {
        const v = b.valeurs.find((x) => x.champ_id === c.id)?.valeur_num;
        return v === null || v === undefined ? [] : [{ date: b.date_mesure, valeur: Number(v) }];
      });
      if (points.length < 2) return [];
      const depart = points[0].valeur;
      const actuel = points.at(-1)!.valeur;
      return [{ libelle: c.libelle, unite: c.unite, depart, actuel, ecart: Math.round((actuel - depart) * 10) / 10, points }];
    });
}

export type Progression = { nom: string; depart: number; meilleur: number };

/** Exercices où elle a progressé : charge de sa première séance → sa meilleure charge (6 au plus, les plus gros progrès d'abord). */
export function progressionCharges(charges: { exercice_cle: string; exercice_nom: string; charge_kg: number; jour: string }[]): Progression[] {
  const parExercice = new Map<string, typeof charges>();
  for (const c of charges) if (c.charge_kg > 0) parExercice.set(c.exercice_cle, [...(parExercice.get(c.exercice_cle) ?? []), c]);
  const liste: Progression[] = [];
  for (const lignes of parExercice.values()) {
    const premierJour = lignes.reduce((m, c) => (c.jour < m ? c.jour : m), lignes[0].jour);
    const depart = Math.max(...lignes.filter((c) => c.jour === premierJour).map((c) => c.charge_kg));
    const meilleur = Math.max(...lignes.map((c) => c.charge_kg));
    if (meilleur > depart) liste.push({ nom: lignes[0].exercice_nom.trim(), depart, meilleur });
  }
  return liste.sort((a, b) => b.meilleur / b.depart - a.meilleur / a.depart).slice(0, 6);
}

/** Photos avant / après : le premier et le dernier bilan qui ont une photo de face (sinon de profil, sinon de dos). */
export function avantApres(bilans: Bilan[]): { avant: { date: string; chemin: string }; apres: { date: string; chemin: string } } | null {
  const chrono = [...bilans].sort((a, b) => a.date_mesure.localeCompare(b.date_mesure));
  for (const angle of ["face", "profil", "dos"] as const) {
    const avec = chrono.flatMap((b) => {
      const p = b.photos.find((x) => x.angle === angle);
      return p ? [{ date: b.date_mesure, chemin: p.fichier_path }] : [];
    });
    if (avec.length >= 2 && avec[0].date !== avec.at(-1)!.date) return { avant: avec[0], apres: avec.at(-1)! };
  }
  return null;
}

export type Offre = { titre: string; description: string };

/** Offres saisies par la coach (Réglages), nettoyées. */
export function lireOffres(brut: unknown): Offre[] {
  if (!Array.isArray(brut)) return [];
  return brut
    .map((o) => ({
      titre: String((o as Offre)?.titre ?? "").trim().slice(0, 120),
      description: String((o as Offre)?.description ?? "").trim().slice(0, 500),
    }))
    .filter((o) => o.titre)
    .slice(0, 6);
}

/** « +2,5 », « −3 » (signe typographique). */
export const ecartSigne = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("fr-FR")}`;
