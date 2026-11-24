/**
 * Tableau de bord de la coach (logique pure) : toutes les actions à venir,
 * rangées par urgence — à faire maintenant, cette semaine, dans les 2 semaines.
 */

import { joursEntre } from "./bilan";

export type TypeTache =
  | "note"
  | "bilan_recu"
  | "bilan_manquant"
  | "bilan_prevu"
  | "paiement"
  | "programme"
  | "programme_auto"
  | "fin_suivi"
  | "suite"
  | "decrochage"
  | "signalement"
  | "rgpd";

export type Tache = {
  id: string;
  type: TypeTache;
  /** Jour concerné (AAAA-MM-JJ) : échéance, date prévue, ou jour de réception. */
  date: string;
  /** En gras : la cliente (ou l'objet). */
  titre: string;
  /** La phrase qui dit quoi faire. */
  detail: string;
  lien: string;
  montant?: number;
};

/** Catégorie affichée sur chaque ligne. */
export const CATEGORIE: Record<TypeTache, string> = {
  note: "À lire vite",
  bilan_recu: "Bilan",
  bilan_manquant: "Bilan",
  bilan_prevu: "Bilan",
  paiement: "Paiement",
  programme: "Sport",
  programme_auto: "Sport",
  fin_suivi: "Suivi",
  suite: "Suivi",
  decrochage: "Suivi",
  signalement: "Communauté",
  rgpd: "Données",
};

/** Ce qui n'attend rien de la coach (simple information) : jamais « en retard ». */
const INFORMATIF: TypeTache[] = ["bilan_prevu", "programme_auto"];
/** À traiter dès que ça arrive, quelle que soit la date. */
const IMMEDIAT: TypeTache[] = ["note", "suite", "bilan_recu", "bilan_manquant", "decrochage", "signalement", "rgpd"];
/** Ordre dans une même journée : ce qui demande une action d'abord. */
const PRIORITE: TypeTache[] = [
  "note",
  "suite",
  "signalement",
  "bilan_recu",
  "paiement",
  "bilan_manquant",
  "programme",
  "decrochage",
  "fin_suivi",
  "rgpd",
  "programme_auto",
  "bilan_prevu",
];

export type Agenda = { maintenant: Tache[]; semaine: Tache[]; plusTard: Tache[]; enRetard: number };

/** Range les tâches : maintenant (en retard ou aujourd'hui), 1 à 7 jours, 8 à 14 jours. Au-delà : ignoré. */
export function classerTaches(taches: Tache[], aujourdhui: string): Agenda {
  const tri = (a: Tache, b: Tache) => a.date.localeCompare(b.date) || PRIORITE.indexOf(a.type) - PRIORITE.indexOf(b.type);
  const agenda: Agenda = { maintenant: [], semaine: [], plusTard: [], enRetard: 0 };
  for (const t of taches) {
    const j = IMMEDIAT.includes(t.type) ? Math.min(0, joursEntre(aujourdhui, t.date)) : joursEntre(aujourdhui, t.date);
    if (j <= 0) {
      if (INFORMATIF.includes(t.type) && j < 0) continue; // une information passée n'a plus d'intérêt
      agenda.maintenant.push(t);
      if (enRetard(t, aujourdhui)) agenda.enRetard++;
    } else if (j <= 7) agenda.semaine.push(t);
    else if (j <= 14) agenda.plusTard.push(t);
  }
  // Maintenant : les retards d'abord (les plus anciens en tête), puis le reste du jour par priorité.
  agenda.maintenant.sort((a, b) => Number(enRetard(b, aujourdhui)) - Number(enRetard(a, aujourdhui)) || tri(a, b));
  agenda.semaine.sort(tri);
  agenda.plusTard.sort(tri);
  return agenda;
}

/** En retard : une échéance dépassée (paiement, programme, bilan manquant), ou un bilan reçu qui attend depuis plus de 2 jours. */
export function enRetard(t: Tache, aujourdhui: string): boolean {
  if (INFORMATIF.includes(t.type) || t.type === "note" || t.type === "suite" || t.type === "signalement" || t.type === "decrochage" || t.type === "rgpd") return false;
  if (t.type === "bilan_recu") return joursEntre(t.date, aujourdhui) > 2;
  if (t.type === "bilan_manquant") return true;
  return t.date < aujourdhui;
}

const JOURS = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });

/** « aujourd'hui », « demain », « en retard de 3 j », « reçu il y a 2 j », « jeudi 26 nov. ». */
export function quand(t: Tache, aujourdhui: string): string {
  const j = joursEntre(aujourdhui, t.date);
  if (t.type === "bilan_recu") return j === 0 ? "reçu aujourd’hui" : j === -1 ? "reçu hier" : `reçu il y a ${-j} j`;
  if (t.type === "bilan_manquant") return `attendu depuis ${-j} j`;
  if (t.type === "note") return j === 0 ? "écrit aujourd’hui" : j === -1 ? "écrit hier" : `écrit il y a ${-j} j`;
  if (t.type === "suite") return j === 0 ? "aujourd’hui" : j === -1 ? "hier" : `il y a ${-j} j`;
  if (t.type === "signalement" || t.type === "decrochage" || t.type === "rgpd") return "à regarder";
  if (j < 0) return `en retard de ${-j} j`;
  if (j === 0) return "aujourd’hui";
  if (j === 1) return "demain";
  return JOURS.format(new Date(`${t.date}T12:00:00Z`));
}

/** Phrase d'accueil : « 3 choses à faire aujourd'hui, dont 1 en retard. » */
export function resume(agenda: Agenda): string {
  const n = agenda.maintenant.length;
  if (n === 0) return agenda.semaine.length ? "Rien d’urgent aujourd’hui. Voici ce qui arrive cette semaine." : "Rien d’urgent : tout est à jour. 🎉";
  const choses = `${n} chose${n > 1 ? "s" : ""} à faire aujourd’hui`;
  return agenda.enRetard ? `${choses}, dont ${agenda.enRetard} en retard.` : `${choses}.`;
}
