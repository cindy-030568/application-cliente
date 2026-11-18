/**
 * Suivi des revenus de la coach (logique pure, testée).
 * Deux sources : les échéances des clientes (prévues / encaissées) et les revenus hors échéancier.
 */
import { MOYENS, type Moyen } from "./paiements";

export type Mouvement = {
  id: string;
  type: "echeance" | "divers";
  cliente_id: string | null;
  cliente: string | null;
  formule: string | null;
  /** « Échéance 2/3 », ou le libellé du revenu. */
  libelle: string;
  /** Date prévue (échéance) ou date du revenu. */
  date_prevue: string;
  montant: number;
  /** Date d'encaissement (null = pas encore encaissé). */
  payee_le: string | null;
  moyen: Moyen | null;
  note: string | null;
};

const c = (x: number) => Math.round(x * 100);
const e = (centimes: number) => centimes / 100;
const annee = (iso: string) => Number(iso.slice(0, 4));
const mois = (iso: string) => Number(iso.slice(5, 7));

export const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export type Synthese = {
  encaisseAnnee: number;
  encaisseMois: number;
  prevuAnnee: number;
  aVenir: number;
  nbAVenir: number;
  enRetard: number;
  nbEnRetard: number;
  moyenneMensuelle: number;
  parMois: { mois: number; encaisse: number; prevu: number }[];
  parFormule: { formule: string; montant: number }[];
  parMoyen: { moyen: string; montant: number }[];
};

/**
 * Synthèse d'une année.
 * - encaissé : ce qui a été payé dans l'année (date d'encaissement) ;
 * - prévu : tout ce qui était attendu dans l'année (date prévue), payé ou non ;
 * - à venir / en retard : tout ce qui reste à encaisser, quelle que soit l'année.
 */
export function synthese(mvts: Mouvement[], an: number, aujourdhui: string): Synthese {
  const parMois = Array.from({ length: 12 }, (_, i) => ({ mois: i + 1, encaisse: 0, prevu: 0 }));
  const formules = new Map<string, number>();
  const moyens = new Map<string, number>();
  let encaisseAnnee = 0, encaisseMois = 0, prevuAnnee = 0, aVenir = 0, nbAVenir = 0, enRetard = 0, nbEnRetard = 0;
  const moisCourant = aujourdhui.slice(0, 7);

  for (const m of mvts) {
    const v = c(m.montant);
    if (annee(m.date_prevue) === an) {
      prevuAnnee += v;
      parMois[mois(m.date_prevue) - 1].prevu += v;
    }
    if (m.payee_le) {
      if (annee(m.payee_le) === an) {
        encaisseAnnee += v;
        parMois[mois(m.payee_le) - 1].encaisse += v;
        const f = m.formule?.trim() || (m.type === "divers" ? "Hors accompagnement" : "Sans formule");
        formules.set(f, (formules.get(f) ?? 0) + v);
        const mo = m.moyen ? MOYENS[m.moyen] : "Non précisé";
        moyens.set(mo, (moyens.get(mo) ?? 0) + v);
      }
      if (m.payee_le.slice(0, 7) === moisCourant) encaisseMois += v;
    } else if (m.date_prevue < aujourdhui) {
      enRetard += v;
      nbEnRetard++;
    } else {
      aVenir += v;
      nbAVenir++;
    }
  }

  // Moyenne sur les mois écoulés de l'année (12 pour une année passée).
  const anCourant = annee(aujourdhui);
  const moisEcoules = an < anCourant ? 12 : an > anCourant ? 0 : mois(aujourdhui);
  const tri = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  return {
    encaisseAnnee: e(encaisseAnnee),
    encaisseMois: e(encaisseMois),
    prevuAnnee: e(prevuAnnee),
    aVenir: e(aVenir),
    nbAVenir,
    enRetard: e(enRetard),
    nbEnRetard,
    moyenneMensuelle: moisEcoules ? e(Math.round(encaisseAnnee / moisEcoules)) : 0,
    parMois: parMois.map((p) => ({ mois: p.mois, encaisse: e(p.encaisse), prevu: e(p.prevu) })),
    parFormule: tri(formules).map(([formule, v]) => ({ formule, montant: e(v) })),
    parMoyen: tri(moyens).map(([moyen, v]) => ({ moyen, montant: e(v) })),
  };
}

/** Ce qui reste à encaisser : les retards d'abord (du plus ancien), puis à venir. */
export function aEncaisser(mvts: Mouvement[]): Mouvement[] {
  return mvts.filter((m) => !m.payee_le).sort((a, b) => a.date_prevue.localeCompare(b.date_prevue));
}

/** Encaissements d'une année, du plus récent au plus ancien (filtre mois facultatif, 1-12). */
export function encaissements(mvts: Mouvement[], an: number, moisFiltre?: number | null): Mouvement[] {
  return mvts
    .filter((m) => m.payee_le && annee(m.payee_le) === an && (!moisFiltre || mois(m.payee_le) === moisFiltre))
    .sort((a, b) => b.payee_le!.localeCompare(a.payee_le!) || (a.cliente ?? "").localeCompare(b.cliente ?? "", "fr"));
}

/** « Échéance 2/3 » pour chaque échéance d'une cliente, dans l'ordre des dates. */
export function numeroterEcheances<T extends { id: string; cliente_id: string; date_echeance: string }>(liste: T[]): Map<string, string> {
  const parCliente = new Map<string, T[]>();
  for (const x of liste) parCliente.set(x.cliente_id, [...(parCliente.get(x.cliente_id) ?? []), x]);
  const noms = new Map<string, string>();
  for (const l of parCliente.values()) {
    const tri = [...l].sort((a, b) => a.date_echeance.localeCompare(b.date_echeance));
    tri.forEach((x, i) => noms.set(x.id, tri.length > 1 ? `Échéance ${i + 1}/${tri.length}` : "Paiement"));
  }
  return noms;
}

/** Jours de retard (0 si à l'heure). */
export function joursDeRetard(m: Pick<Mouvement, "date_prevue" | "payee_le">, aujourdhui: string): number {
  if (m.payee_le || m.date_prevue >= aujourdhui) return 0;
  return Math.round((Date.parse(aujourdhui) - Date.parse(m.date_prevue)) / 86400000);
}

const cellule = (v: string) => {
  const s = v.replace(/\r?\n/g, " ");
  return /[";]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const dateFr = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");
const montantFr = (x: number) => x.toFixed(2).replace(".", ",");

/** Encaissements de l'année en CSV (« ; », virgule décimale) : s'ouvre dans Excel, pour la comptabilité. */
export function csvEncaissements(mvts: Mouvement[], an: number): string {
  const entete = ["Date d'encaissement", "Cliente", "Formule", "Libellé", "Montant (€)", "Moyen", "Date prévue", "Note"];
  const lignes = encaissements(mvts, an)
    .slice()
    .reverse()
    .map((m) => [
      dateFr(m.payee_le),
      m.cliente ?? "",
      m.formule ?? "",
      m.libelle,
      montantFr(m.montant),
      m.moyen ? MOYENS[m.moyen] : "",
      dateFr(m.date_prevue),
      m.note ?? "",
    ]);
  const total = encaissements(mvts, an).reduce((s, m) => s + c(m.montant), 0);
  lignes.push(["", "", "", "Total", montantFr(e(total)), "", "", ""]);
  return "﻿" + [entete, ...lignes].map((l) => l.map(cellule).join(";")).join("\r\n");
}
