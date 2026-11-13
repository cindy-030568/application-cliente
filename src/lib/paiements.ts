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
};
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

/**
 * Échéancier mensuel : `nbFois` mensualités égales à partir de `premiere`.
 * Les centimes qui ne se divisent pas sont ajoutés à la première.
 */
export function genererEcheances(totalCentimes: number, nbFois: number, premiere: string) {
  const n = Math.max(1, Math.floor(nbFois));
  const base = Math.floor(totalCentimes / n);
  const reste = totalCentimes - base * n;
  return Array.from({ length: n }, (_, i) => ({
    date_echeance: ajouterMois(premiere, i),
    montant: (base + (i === 0 ? reste : 0)) / 100,
  }));
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
) {
  const dejaPaye = payees.reduce((s, e) => s + Math.round(e.montant * 100), 0);
  const reste = totalCentimes - dejaPaye;
  const nbReste = nbFois - payees.length;
  if (reste <= 0 || nbReste <= 0) return [];
  return genererEcheances(reste, nbReste, ajouterMois(premiere, payees.length));
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
