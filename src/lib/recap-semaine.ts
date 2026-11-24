/**
 * Récap de la semaine (logique pure, testée) : du lundi au dimanche, les séances faites,
 * les moyennes de sommeil, de pas et d'hydratation, et une phrase encourageante.
 * Envoyé le dimanche à 18 h (heure de Paris). Jamais le poids ni les mensurations.
 */
import { ajouterJours, joursEntre } from "./bilan";
import { encouragementDuJour } from "./encouragements";

export const HEURE_RECAP = "18:00";

export type JourRecap = { jour: string; sommeil: number | null; pas: number | null; hydratation: number | null };

export type Recap = {
  lundi: string;
  dimanche: string;
  seances: number;
  joursRemplis: number;
  sommeil: number | null;
  pas: number | null;
  hydratation: number | null;
  phrase: string;
};

/** Lundi de la semaine d'un jour (AAAA-MM-JJ). */
export function lundiDe(jour: string): string {
  const d = new Date(`${jour}T12:00:00Z`);
  return ajouterJours(jour, -((d.getUTCDay() + 6) % 7));
}

export const estDimanche = (jour: string) => new Date(`${jour}T12:00:00Z`).getUTCDay() === 0;

/**
 * La semaine à montrer : celle qui se termine aujourd'hui si on est dimanche après 18 h,
 * sinon la dernière semaine terminée. Renvoie son dimanche.
 */
export function dimancheDuRecap(aujourdhui: string, heure: string): string {
  if (estDimanche(aujourdhui) && heure >= HEURE_RECAP) return aujourdhui;
  return ajouterJours(lundiDe(aujourdhui), -1);
}

/** Le récap est « nouveau » (carte sur l'accueil) du dimanche 18 h au mardi soir. */
export function recapRecent(aujourdhui: string, heure: string): string | null {
  const dimanche = dimancheDuRecap(aujourdhui, heure);
  return joursEntre(dimanche, aujourdhui) <= 2 ? dimanche : null;
}

/** La notification part-elle maintenant ? Le dimanche à partir de 18 h, une fois par semaine. */
export function recapADonner(o: { aujourdhui: string; heure: string; dejaEnvoye: string | null }): boolean {
  return estDimanche(o.aujourdhui) && o.heure >= HEURE_RECAP && o.dejaEnvoye !== o.aujourdhui;
}

const moyenne = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/** 7,25 h → « 7 h 15 ». */
export function formaterHeures(h: number): string {
  const total = Math.round(h * 60);
  const m = total % 60;
  return `${Math.floor(total / 60)} h${m ? ` ${String(m).padStart(2, "0")}` : ""}`;
}
export const formaterPas = (n: number) => Math.round(n).toLocaleString("fr-FR");
export const formaterLitres = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("fr-FR")} L`;

/** Une phrase qui colle à la semaine (toujours bienveillante, jamais culpabilisante). */
function phraseDeLaSemaine(r: Omit<Recap, "phrase">, prenom: string): string {
  const p = prenom.trim();
  const toi = p ? `${p}, ` : "";
  if (r.joursRemplis === 0 && r.seances === 0) {
    return `${toi}une semaine plus calme, ça arrive : la nouvelle commence, et on repart ensemble, petit pas par petit pas 💛`;
  }
  if (r.seances >= 3) return `${toi}quelle semaine ! ${r.seances} séances, tu peux être fière de ta régularité 🔥`;
  if (r.sommeil !== null && r.sommeil >= 7.5) return `${toi}de belles nuits cette semaine : ton corps récupère, et ça se voit sur l’énergie 😴✨`;
  if (r.pas !== null && r.pas >= 8000) return `${toi}tu as beaucoup bougé cette semaine : chaque pas compte, bravo 👟`;
  if (r.joursRemplis >= 6) return `${toi}ton journal presque tous les jours : cette constance, c’est ta force 📒`;
  return `${encouragementDuJour(r.dimanche)} 💛`;
}

export function calculerRecap(o: { dimanche: string; seances: string[]; journal: JourRecap[]; prenom: string }): Recap {
  const lundi = ajouterJours(o.dimanche, -6);
  const dans = (j: string) => j >= lundi && j <= o.dimanche;
  const jours = o.journal.filter((j) => dans(j.jour));
  const sansPhrase = {
    lundi,
    dimanche: o.dimanche,
    seances: o.seances.filter(dans).length,
    joursRemplis: new Set(jours.map((j) => j.jour)).size,
    sommeil: moyenne(jours.map((j) => j.sommeil)),
    pas: moyenne(jours.map((j) => j.pas)),
    hydratation: moyenne(jours.map((j) => j.hydratation)),
  };
  return { ...sansPhrase, phrase: phraseDeLaSemaine(sansPhrase, o.prenom) };
}

/** Texte court de la notification. */
export function texteNotificationRecap(r: Recap): string {
  const morceaux = [
    `${r.seances} séance${r.seances > 1 ? "s" : ""}`,
    r.sommeil !== null && `${formaterHeures(r.sommeil)} de sommeil`,
    r.pas !== null && `${formaterPas(r.pas)} pas/jour`,
  ].filter(Boolean);
  return `${morceaux.join(" · ")}. Viens voir ta semaine 💛`;
}
