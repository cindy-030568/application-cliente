/**
 * Mode séance (logique pure) : une séance du programme devient une suite d'étapes
 * que la cliente suit une par une — série, repos (minuteur), série suivante…
 */

import type { Bloc, Exercice, Seance } from "./programme-sportif";

export type EtapeSerie = {
  type: "serie";
  bloc: string | null;
  exercice: Exercice;
  /** Série (ou tour d'un circuit) en cours, à partir de 1. */
  numero: number;
  total: number;
  /** « tour » pour un circuit (on enchaîne les exercices puis on recommence), « serie » sinon. */
  unite: "serie" | "tour";
};
export type EtapeRepos = { type: "repos"; secondes: number; /** Ce qui vient après, pour se préparer. */ ensuite: string };
export type EtapeTexte = { type: "texte"; titre: string; texte: string };
export type EtapeChrono = {
  type: "chrono";
  bloc: string | null;
  format: string;
  mode: "amrap" | "emom" | "fortime" | "tabata";
  /** Durée totale (AMRAP, EMOM, Tabata) ou plafond de temps (For time) ; null = sans limite. */
  secondes: number | null;
  /** EMOM : une minute (ou plus) par intervalle ; Tabata : 20 s d'effort / 10 s de repos. */
  intervalle: number | null;
  exercices: Exercice[];
};
export type Etape = EtapeSerie | EtapeRepos | EtapeTexte | EtapeChrono;

const nombres = (t: string) => [...t.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(",", ".")));

/**
 * Temps de repos en secondes : « 90 s », « 1 min 30 », « 1'30 », « 1:30 », « 2 min », « 60-90 s » (le plus long).
 * null si on ne sait pas le lire (ex. « libre »).
 */
export function lireSecondes(t: string | null): number | null {
  if (!t) return null;
  const s = t.toLowerCase().replace(/\s+/g, " ").trim();
  const minSec = s.match(/(\d+)\s*(?:min|mn|m|'|:)\s*(\d{1,2})(?!\d)/);
  if (minSec) return borner(Number(minSec[1]) * 60 + Number(minSec[2]));
  const n = nombres(s);
  if (!n.length) return null;
  const max = Math.max(...n);
  if (/min|mn|'/.test(s)) return borner(Math.round(max * 60));
  if (/s|sec/.test(s) || n.length) return borner(Math.round(max));
  return null;
}
const borner = (x: number) => (x > 0 ? Math.min(x, 15 * 60) : null);

/** Nombre de séries : « 4 » → 4 ; « 3-4 » → 4 ; vide → 1. */
export function nombreSeries(t: string | null): number {
  const n = t ? nombres(t) : [];
  return n.length ? Math.min(Math.max(1, Math.round(Math.max(...n))), 20) : 1;
}

type Lecture =
  | { mode: "amrap" | "emom" | "fortime" | "tabata"; secondes: number | null; intervalle: number | null }
  | { mode: "circuit"; tours: number | null; reposTours: number | null }
  | { mode: "series" };

/** Comprend le format d'un bloc (« 4 séries », « 3 tours », « AMRAP 10 min », « EMOM 12 min », « For time », « Tabata »). */
export function lireFormat(format: string | null): Lecture {
  const f = (format ?? "").toLowerCase();
  const minutes = (re: RegExp) => {
    const m = f.match(re);
    return m ? Number(m[1]) * 60 : null;
  };
  if (/amrap/.test(f)) return { mode: "amrap", secondes: minutes(/amrap\D*(\d+)/) ?? minutes(/(\d+)\s*min/), intervalle: null };
  const emom = f.match(/e(\d*)mom\D*(\d+)?/);
  if (emom) {
    const pas = (Number(emom[1]) || 1) * 60;
    return { mode: "emom", secondes: emom[2] ? Number(emom[2]) * 60 : minutes(/(\d+)\s*min/), intervalle: pas };
  }
  if (/tabata/.test(f)) return { mode: "tabata", secondes: 4 * 60, intervalle: 20 };
  if (/for time|chrono|le plus vite/.test(f)) return { mode: "fortime", secondes: minutes(/(?:cap|max|limite)\D*(\d+)/), intervalle: null };
  if (/tours?|rounds?|rondes?|circuit|superset|super-set|bi-set|tri-set/.test(f)) {
    const tours = f.match(/(\d+)\s*(?:tours?|rounds?|rondes?)/);
    const repos = f.match(/repos\s*:?\s*([^,;()]+)/);
    return { mode: "circuit", tours: tours ? Number(tours[1]) : null, reposTours: repos ? lireSecondes(repos[1]) : null };
  }
  return { mode: "series" };
}

const descriptionSerie = (e: EtapeSerie) =>
  `${e.exercice.nom} · ${e.unite === "tour" ? "tour" : "série"} ${e.numero}/${e.total}`;

function etapesBloc(b: Bloc): Etape[] {
  const lecture = lireFormat(b.format);
  if (lecture.mode !== "series" && lecture.mode !== "circuit") {
    return [{ type: "chrono", bloc: b.titre, format: b.format ?? "", mode: lecture.mode, secondes: lecture.secondes, intervalle: lecture.intervalle, exercices: b.exercices }];
  }
  const etapes: Etape[] = [];
  const repos = (secondes: number | null) => {
    if (secondes) etapes.push({ type: "repos", secondes, ensuite: "" });
  };
  if (lecture.mode === "circuit") {
    const tours = lecture.tours ?? Math.max(...b.exercices.map((e) => nombreSeries(e.series)), 1);
    for (let t = 1; t <= tours; t++) {
      b.exercices.forEach((e, i) => {
        etapes.push({ type: "serie", bloc: b.titre, exercice: e, numero: t, total: tours, unite: "tour" });
        if (i < b.exercices.length - 1) repos(lireSecondes(e.repos));
      });
      repos(lecture.reposTours ?? lireSecondes(b.exercices.at(-1)?.repos ?? null));
    }
    return etapes;
  }
  for (const e of b.exercices) {
    const total = nombreSeries(e.series);
    for (let s = 1; s <= total; s++) {
      etapes.push({ type: "serie", bloc: b.titre, exercice: e, numero: s, total, unite: "serie" });
      repos(lireSecondes(e.repos));
    }
  }
  return etapes;
}

/** Toutes les étapes d'une séance, de l'échauffement au retour au calme. */
export function etapesSeance(s: Seance): Etape[] {
  const brutes: Etape[] = [];
  if (s.echauffement) brutes.push({ type: "texte", titre: "Échauffement", texte: s.echauffement });
  for (const b of s.blocs) brutes.push(...etapesBloc(b));
  if (s.retour_au_calme) brutes.push({ type: "texte", titre: "Retour au calme", texte: s.retour_au_calme });

  // Pas de repos en fin de séance, ni juste avant le retour au calme ou un autre repos.
  const etapes = brutes.filter((e, i) => {
    if (e.type !== "repos") return true;
    const apres = brutes[i + 1];
    return apres !== undefined && apres.type !== "repos" && !(apres.type === "texte" && apres.titre === "Retour au calme");
  });
  // « Ensuite » : ce qui suit chaque repos.
  etapes.forEach((e, i) => {
    if (e.type !== "repos") return;
    const apres = etapes[i + 1];
    e.ensuite =
      apres.type === "serie" ? descriptionSerie(apres) : apres.type === "chrono" ? `${apres.bloc ?? "Bloc"} · ${apres.format}` : apres.type === "texte" ? apres.titre : "";
  });
  return etapes;
}

/** « 1:30 », « 0:45 », « 12:00 ». */
export function formaterDuree(secondes: number): string {
  const s = Math.max(0, Math.ceil(secondes));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Tabata / EMOM : où en est-on à `ecoule` secondes ? (tour à partir de 1, phase, secondes restantes dans la phase). */
export function phaseIntervalle(mode: "emom" | "tabata", intervalle: number, ecoule: number): { tour: number; phase: "effort" | "repos"; reste: number } {
  if (mode === "emom") {
    const tour = Math.floor(ecoule / intervalle) + 1;
    return { tour, phase: "effort", reste: intervalle - (ecoule % intervalle) };
  }
  const cycle = intervalle + 10;
  const tour = Math.floor(ecoule / cycle) + 1;
  const dans = ecoule % cycle;
  return dans < intervalle ? { tour, phase: "effort", reste: intervalle - dans } : { tour, phase: "repos", reste: cycle - dans };
}

/** Ressenti noté par la cliente à la fin de la séance (1 à 5). */
export const RESSENTIS = [
  { valeur: 1, emoji: "😌", libelle: "Très facile" },
  { valeur: 2, emoji: "🙂", libelle: "Facile" },
  { valeur: 3, emoji: "💪", libelle: "Bien" },
  { valeur: 4, emoji: "😮‍💨", libelle: "Dur" },
  { valeur: 5, emoji: "🥵", libelle: "Très dur" },
] as const;

/** Séances faites par séance du programme : combien de fois, et la dernière date. */
export function resumeSeancesFaites(faites: { seance_nom: string; faite_le: string }[]): Record<string, { nb: number; derniere: string }> {
  const r: Record<string, { nb: number; derniere: string }> = {};
  for (const f of faites) {
    const x = (r[f.seance_nom] ??= { nb: 0, derniere: f.faite_le });
    x.nb++;
    if (f.faite_le > x.derniere) x.derniere = f.faite_le;
  }
  return r;
}

// ---------------------------------------------------------------- Poids utilisés

export type LigneCharge = { seance_ref: string; exercice_cle: string; serie: number; charge_kg: number | string; faite_le: string };
export type SeanceCharges = { ref: string; date: string; series: { serie: number; kg: number }[] };
/** Par exercice (nom normalisé) : ses dernières séances, la plus récente d'abord. */
export type HistoriqueCharges = Record<string, SeanceCharges[]>;

/** « 14 », « 14,5 », « 14.5 kg » → 14,5 ; null si vide ou illisible. */
export function lireKg(t: string): number | null {
  const m = t.trim().replace(",", ".").match(/^\d{1,3}(\.\d+)?/);
  if (!m) return null;
  const n = Math.round(Number(m[0]) * 10) / 10;
  return n >= 0 && n <= 500 ? n : null;
}

/** 14 → « 14 » ; 14.5 → « 14,5 ». */
export function formaterKg(n: number): string {
  return String(Math.round(n * 10) / 10).replace(".", ",");
}

/** Regroupe les charges enregistrées par exercice puis par séance (3 dernières séances gardées). */
export function regrouperCharges(lignes: LigneCharge[]): HistoriqueCharges {
  const r: HistoriqueCharges = {};
  const triees = [...lignes].sort((a, b) => b.faite_le.localeCompare(a.faite_le));
  for (const l of triees) {
    const seances = (r[l.exercice_cle] ??= []);
    let s = seances.find((x) => x.ref === l.seance_ref);
    if (!s) {
      if (seances.length >= 3) continue;
      s = { ref: l.seance_ref, date: l.faite_le, series: [] };
      seances.push(s);
    }
    if (!s.series.some((x) => x.serie === l.serie)) s.series.push({ serie: l.serie, kg: Number(l.charge_kg) });
  }
  for (const seances of Object.values(r)) for (const s of seances) s.series.sort((a, b) => a.serie - b.serie);
  return r;
}

/** La dernière séance (autre que celle en cours) où elle a noté un poids pour cet exercice. */
export function derniereFois(historique: HistoriqueCharges, cle: string, refEnCours: string | null): SeanceCharges | null {
  return (historique[cle] ?? []).find((s) => s.ref !== refEnCours && s.series.length > 0) ?? null;
}

/**
 * Poids proposé pour une série : celui de la série d'avant dans la séance en cours,
 * sinon celui de la même série la dernière fois, sinon la dernière charge de la dernière fois.
 */
export function chargeProposee(enCours: Record<string, number>, cle: string, serie: number, derniere: SeanceCharges | null): number | null {
  for (let s = serie - 1; s >= 1; s--) if (enCours[`${cle}#${s}`] !== undefined) return enCours[`${cle}#${s}`];
  if (!derniere) return null;
  return derniere.series.find((x) => x.serie === serie)?.kg ?? derniere.series.at(-1)?.kg ?? null;
}
