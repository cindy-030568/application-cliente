/**
 * Compléments (logique pure, testée) : moments de prise, rappel du jour.
 * La coach saisit quoi prendre, quand et combien ; la cliente coche ; un rappel discret par jour si elle l'active.
 */
import { rappelJournalDu } from "./journal";

export const MOMENTS = [
  { code: "matin", libelle: "Le matin" },
  { code: "midi", libelle: "Le midi" },
  { code: "soir", libelle: "Le soir" },
  { code: "coucher", libelle: "Au coucher" },
  { code: "avant_sport", libelle: "Avant le sport" },
  { code: "apres_sport", libelle: "Après le sport" },
  { code: "autre", libelle: "À un autre moment" },
] as const;
export type Moment = (typeof MOMENTS)[number]["code"];
export const CODES_MOMENTS = MOMENTS.map((m) => m.code) as readonly string[];
export const libelleMoment = (code: string) => MOMENTS.find((m) => m.code === code)?.libelle ?? code;

export type Complement = { id: string; nom: string; moment: Moment; quantite: string; note: string | null; ordre: number; actif: boolean };

/** Rangés par moment de la journée, puis dans l'ordre choisi par la coach. */
export function parMoment<T extends Pick<Complement, "moment" | "ordre">>(liste: T[]): { moment: Moment; libelle: string; complements: T[] }[] {
  return MOMENTS.map((m) => ({
    moment: m.code,
    libelle: m.libelle,
    complements: liste.filter((c) => c.moment === m.code).sort((a, b) => a.ordre - b.ordre),
  })).filter((g) => g.complements.length);
}

/** Le rappel part-il maintenant ? Même règle que le journal : heure passée depuis moins de 3 h, une fois par jour, s'il reste quelque chose à prendre. */
export function rappelComplementsDu(o: { heure: string | null; maintenant: string; envoyeLe: string | null; aujourdhui: string; resteAPrendre: number }): boolean {
  return rappelJournalDu({ heure: o.heure, maintenant: o.maintenant, envoyeLe: o.envoyeLe, aujourdhui: o.aujourdhui, journeeRemplie: o.resteAPrendre === 0 });
}

/** Texte discret de la notification (seulement ce qui reste à prendre aujourd'hui). */
export function texteRappelComplements(noms: string[]): string {
  const liste = noms.length <= 3 ? noms.join(", ") : `${noms.slice(0, 3).join(", ")} et ${noms.length - 3} autre${noms.length > 4 ? "s" : ""}`;
  return `Petit rappel : ${liste} 🌿`;
}
