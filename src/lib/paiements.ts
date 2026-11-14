import { formaterDate } from "@/lib/bilan";

/** Formule et paiement des clientes : fonctions pures (testées). Visible par la coach seule. */

export const MOYENS = {
  virement: "Virement",
  carte: "Carte bancaire",
  paypal: "PayPal",
  especes: "Espèces",
  cheque: "Chèque",
  autre: "Autre",
} as const;
export type Moyen = keyof typeof MOYENS;
export const estMoyen = (x: unknown): x is Moyen => typeof x === "string" && x in MOYENS;
export const NB_FOIS_MAX = 12;

export type Paiement = {
  formule: string | null;
  montant_total: number | null;
  moyen: Moyen | null;
  nb_fois: number;
  note: string | null;
  /** 1er paiement en plusieurs fois (null = 50 % du total). */
  premier_montant: number | null;
  /** Rappel à la cliente le jour de chaque échéance. */
  rappels: boolean;
};

/** Part du 1er paiement par défaut quand on paie en plusieurs fois. */
export const PART_PREMIER_PAIEMENT = 0.5;
export const premierParDefaut = (totalCentimes: number) => Math.round(totalCentimes * PART_PREMIER_PAIEMENT);
export type Echeance = { id: string; date_echeance: string; montant: number; payee_le: string | null };

/** « 450 », « 149,90 », « 1 200 € » → centimes ; null si vide ; NaN si illisible. */
export function lireCentimes(brut: string): number | null {
  const v = brut.replace(/[\s €]/g, "").replace(",", ".");
  if (!v) return null;
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(v)) return NaN;
  return Math.round(Number(v) * 100);
}

export function formaterEuros(montant: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(montant) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(montant);
}

/** Même jour du mois, n mois plus tard (le 31 janv. + 1 mois → 28 ou 29 févr.). */
export function ajouterMois(iso: string, n: number): string {
  const [a, m, j] = iso.split("-").map(Number);
  const cible = new Date(Date.UTC(a, m - 1 + n, 1));
  const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  cible.setUTCDate(Math.min(j, dernier));
  return cible.toISOString().slice(0, 10);
}

/** `n` mensualités égales à partir de `debut` ; les centimes en trop vont sur la première. */
function mensualites(totalCentimes: number, n: number, debut: string, decalage = 0) {
  const base = Math.floor(totalCentimes / n);
  const reste = totalCentimes - base * n;
  return Array.from({ length: n }, (_, i) => ({
    date_echeance: ajouterMois(debut, decalage + i),
    montant: (base + (i === 0 ? reste : 0)) / 100,
  }));
}

/**
 * Échéancier mensuel à partir de `premiere`. En plusieurs fois, le 1er paiement vaut
 * `premierCentimes` (par défaut 50 % du total) et le reste est réparti en mensualités égales.
 */
export function genererEcheances(totalCentimes: number, nbFois: number, premiere: string, premierCentimes?: number | null) {
  const n = Math.max(1, Math.floor(nbFois));
  if (n === 1) return [{ date_echeance: premiere, montant: totalCentimes / 100 }];
  const premier = Math.min(totalCentimes, Math.max(0, premierCentimes ?? premierParDefaut(totalCentimes)));
  return [{ date_echeance: premiere, montant: premier / 100 }, ...mensualites(totalCentimes - premier, n - 1, premiere, 1)];
}

/**
 * Échéances non payées à (re)créer quand la coach enregistre :
 * les échéances déjà payées sont gardées, le reste du montant est réparti
 * sur les mois restants (à partir du mois qui suit les échéances payées).
 */
export function echeancesARecreer(
  totalCentimes: number,
  nbFois: number,
  premiere: string,
  payees: { montant: number }[],
  premierCentimes?: number | null,
) {
  if (payees.length === 0) return genererEcheances(totalCentimes, nbFois, premiere, premierCentimes);
  const dejaPaye = payees.reduce((s, e) => s + Math.round(e.montant * 100), 0);
  const reste = totalCentimes - dejaPaye;
  const nbReste = nbFois - payees.length;
  if (reste <= 0 || nbReste <= 0) return [];
  return mensualites(reste, nbReste, premiere, payees.length);
}

export type EtatEcheance = "payee" | "en_retard" | "a_venir";
export function etatEcheance(e: Pick<Echeance, "date_echeance" | "payee_le">, aujourdhui: string): EtatEcheance {
  if (e.payee_le) return "payee";
  return e.date_echeance < aujourdhui ? "en_retard" : "a_venir";
}

/** Total payé et reste dû (en euros). */
export function bilanPaiement(echeances: Pick<Echeance, "montant" | "payee_le">[]) {
  const c = (x: number) => Math.round(x * 100);
  const paye = echeances.filter((e) => e.payee_le).reduce((s, e) => s + c(e.montant), 0);
  const total = echeances.reduce((s, e) => s + c(e.montant), 0);
  return { paye: paye / 100, reste: (total - paye) / 100 };
}

/** Texte du rappel de paiement (sans détail bancaire). */
export function messagePaiement(prenom: string, montant: number, date: string, aujourdhui: string) {
  const somme = formaterEuros(montant);
  const quand = date === aujourdhui ? "est prévue aujourd’hui" : `était prévue le ${formaterDate(date, { year: undefined })}`;
  return `${prenom ? `Coucou ${prenom} ! ` : "Coucou ! "}Petit rappel : ta mensualité de ${somme} pour ton accompagnement ${quand}. Merci 💛`;
}

