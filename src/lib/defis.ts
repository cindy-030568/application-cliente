/**
 * Défis du mois (logique pure, testée). La réussite et la progression sont calculées par la base
 * (0042, reussites_defi) ; ici : les types, les textes, les dates par défaut et la lecture du formulaire.
 *
 * Réussite : un seuil par jour et un nombre de jours à atteindre (« 8 000 pas au moins 20 jours ») ;
 * pour les séances, un nombre de séances par semaine et un nombre de semaines (semaines de 7 jours
 * à partir du premier jour du défi).
 * Mode sans chiffres : la progression s'affiche avec une jauge et des mots, jamais avec des nombres.
 */
import { ajouterJours, formaterDate, joursEntre } from "./bilan";

export type TypeDefi = "pas" | "seances" | "hydratation" | "sommeil" | "journal";
export type AudienceDefi = "toutes" | "communaute";

export const TYPES_DEFI: { code: TypeDefi; libelle: string; emoji: string; seuil: string | null; min: number; max: number; pas: number; defaut: number | null }[] = [
  { code: "pas", libelle: "Pas", emoji: "👟", seuil: "Pas par jour", min: 100, max: 100000, pas: 500, defaut: 8000 },
  { code: "seances", libelle: "Séances par semaine", emoji: "💪", seuil: "Séances par semaine", min: 1, max: 14, pas: 1, defaut: 3 },
  { code: "hydratation", libelle: "Hydratation", emoji: "💧", seuil: "Litres d’eau par jour", min: 0.25, max: 6, pas: 0.25, defaut: 1.5 },
  { code: "sommeil", libelle: "Sommeil", emoji: "😴", seuil: "Heures de sommeil par nuit", min: 4, max: 12, pas: 0.25, defaut: 7 },
  { code: "journal", libelle: "Journal rempli", emoji: "📒", seuil: null, min: 0, max: 0, pas: 0, defaut: null },
];
export const typeDefi = (code: string) => TYPES_DEFI.find((t) => t.code === code) ?? TYPES_DEFI[0];

export type Defi = {
  id: string;
  titre: string;
  description: string | null;
  type: TypeDefi;
  seuil: number | null;
  objectif: number;
  debut: string;
  fin: string;
  audience: AudienceDefi;
  publie: boolean;
};

export const dureeJours = (d: Pick<Defi, "debut" | "fin">) => joursEntre(d.debut, d.fin) + 1;
/** Semaines complètes de 7 jours à partir du premier jour. */
export const semainesDefi = (d: Pick<Defi, "debut" | "fin">) => Math.floor(dureeJours(d) / 7);
/** Le nombre maximum de réussites possibles (jours, ou semaines pour les séances). */
export const maxObjectif = (d: Pick<Defi, "type" | "debut" | "fin">) => (d.type === "seances" ? semainesDefi(d) : dureeJours(d));

export type EtatDefi = "a_venir" | "en_cours" | "termine";
export function etatDefi(d: Pick<Defi, "debut" | "fin">, aujourdhui: string): EtatDefi {
  if (aujourdhui < d.debut) return "a_venir";
  return aujourdhui > d.fin ? "termine" : "en_cours";
}

const nombre = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
/** 7 → « 7 h », 7,5 → « 7 h 30 ». */
function heures(h: number): string {
  const m = Math.round((h % 1) * 60);
  return `${Math.floor(h)} h${m ? ` ${String(m).padStart(2, "0")}` : ""}`;
}
/** « jour », « nuit » ou « semaine » (au pluriel si besoin). */
export function unite(type: TypeDefi, n: number): string {
  const mot = type === "seances" ? "semaine" : type === "sommeil" ? "nuit" : "jour";
  return n > 1 ? `${mot}s` : mot;
}

/** La règle du défi, en une phrase : « 8 000 pas ou plus, au moins 20 jours ». */
export function texteObjectif(d: Pick<Defi, "type" | "seuil" | "objectif" | "debut" | "fin">): string {
  const s = d.seuil ?? 0;
  switch (d.type) {
    case "pas":
      return `${nombre(s)} pas ou plus, au moins ${d.objectif} ${unite("pas", d.objectif)}`;
    case "hydratation":
      return `${nombre(s)} L d’eau ou plus, au moins ${d.objectif} ${unite("hydratation", d.objectif)}`;
    case "sommeil":
      return `${heures(s)} de sommeil ou plus, au moins ${d.objectif} ${unite("sommeil", d.objectif)}`;
    case "seances": {
      const total = semainesDefi(d);
      const seances = `${s} séance${s > 1 ? "s" : ""} par semaine`;
      return d.objectif >= total ? `${seances}, ${total} ${unite("seances", total)} de suite` : `${seances}, au moins ${d.objectif} ${unite("seances", d.objectif)} sur ${total}`;
    }
    case "journal":
      return `Ton journal rempli au moins ${d.objectif} ${unite("journal", d.objectif)}`;
  }
}

/** « du 1er au 31 décembre », « du 15 novembre au 14 décembre ». */
export function textePeriode(d: Pick<Defi, "debut" | "fin">): string {
  const num = (iso: string) => (Number(iso.slice(8, 10)) === 1 ? "1er" : String(Number(iso.slice(8, 10))));
  const mois = (iso: string) => formaterDate(iso, { day: undefined, month: "long", year: undefined });
  if (d.debut.slice(0, 7) === d.fin.slice(0, 7)) return `du ${num(d.debut)} au ${num(d.fin)} ${mois(d.fin)}`;
  return `du ${num(d.debut)} ${mois(d.debut)} au ${num(d.fin)} ${mois(d.fin)}`;
}

/** Période proposée : le mois en cours si on est dans sa première semaine, sinon le mois suivant. */
export function periodeParDefaut(aujourdhui: string): { debut: string; fin: string } {
  const [a, m, j] = aujourdhui.split("-").map(Number);
  const [an, mois] = j <= 7 ? [a, m] : m === 12 ? [a + 1, 1] : [a, m + 1];
  const debut = `${an}-${String(mois).padStart(2, "0")}-01`;
  const suivant = mois === 12 ? `${an + 1}-01-01` : `${an}-${String(mois + 1).padStart(2, "0")}-01`;
  return { debut, fin: ajouterJours(suivant, -1) };
}

/** Objectif proposé : environ 2 jours sur 3 ; toutes les semaines pour les séances. */
export function objectifParDefaut(d: Pick<Defi, "type" | "debut" | "fin">): number {
  if (d.type === "seances") return Math.max(1, semainesDefi(d));
  return Math.max(1, Math.round(dureeJours(d) * 0.67));
}

/** Lit et vérifie le formulaire de la coach. */
export function lireFormulaireDefi(f: {
  titre?: string;
  description?: string;
  type?: string;
  seuil?: string;
  objectif?: string;
  debut?: string;
  fin?: string;
  audience?: string;
}): { valeurs: Omit<Defi, "id" | "publie">; erreur?: undefined } | { valeurs?: undefined; erreur: string } {
  const titre = (f.titre ?? "").trim().slice(0, 100);
  const description = (f.description ?? "").trim().slice(0, 500) || null;
  const type = TYPES_DEFI.find((t) => t.code === f.type);
  const date = /^\d{4}-\d{2}-\d{2}$/;
  const debut = (f.debut ?? "").trim();
  const fin = (f.fin ?? "").trim();
  if (!titre) return { erreur: "Donne un titre au défi." };
  if (!type) return { erreur: "Choisis le type de défi." };
  if (!date.test(debut) || !date.test(fin)) return { erreur: "Choisis les dates de début et de fin." };
  if (fin < debut) return { erreur: "La date de fin doit être après la date de début." };
  if (joursEntre(debut, fin) > 92) return { erreur: "Un défi dure 3 mois au plus." };
  let seuil: number | null = null;
  if (type.seuil) {
    seuil = Number((f.seuil ?? "").replace(",", ".").replace(/\s/g, ""));
    if (!Number.isFinite(seuil) || seuil < type.min || seuil > type.max) return { erreur: `${type.seuil} : entre ${nombre(type.min)} et ${nombre(type.max)}.` };
    if (type.code === "seances" && !Number.isInteger(seuil)) return { erreur: "Le nombre de séances par semaine est un nombre entier." };
  }
  if (type.code === "seances" && joursEntre(debut, fin) + 1 < 7) return { erreur: "Un défi séances dure au moins une semaine." };
  const objectif = Number(f.objectif);
  const max = maxObjectif({ type: type.code, debut, fin });
  if (!Number.isInteger(objectif) || objectif < 1) return { erreur: `Choisis le nombre de ${unite(type.code, 2)} à réussir.` };
  if (objectif > max) return { erreur: `Ce défi compte ${max} ${unite(type.code, max)} : l’objectif ne peut pas être plus grand.` };
  const audience: AudienceDefi = f.audience === "communaute" ? "communaute" : "toutes";
  return { valeurs: { titre, description, type: type.code, seuil, objectif, debut, fin, audience } };
}

export type Progression = { reussites: number | null; objectif: number; reussi: boolean; groupe: number | null; participantes: number };

/** Ma progression, en mots (et en nombres si la cliente n'est pas en mode sans chiffres). */
export function texteProgression(type: TypeDefi, p: Pick<Progression, "reussites" | "objectif" | "reussi">, sansChiffres: boolean): string {
  if (p.reussi) return "Défi relevé : bravo 🏆";
  const n = p.reussites ?? 0;
  if (!sansChiffres) return `${n} ${unite(type, n)} réussi${type === "seances" ? "e" : ""}${n > 1 ? "s" : ""} sur ${p.objectif}`;
  const part = n / p.objectif;
  if (n === 0) return "C’est parti : chaque jour compte 💪";
  if (part < 0.5) return "Tu avances, continue comme ça 🌱";
  if (part < 0.85) return "Plus de la moitié du chemin : tu tiens le bon bout !";
  return "Tu y es presque, ne lâche rien 🔥";
}

/** Le groupe : pourcentage moyen (à partir de 3 participantes), jamais les chiffres des autres. */
export function texteGroupe(p: Pick<Progression, "groupe" | "participantes">, sansChiffres: boolean): string {
  if (p.groupe === null) return "Le groupe se forme : sa progression s’affichera quand vous serez un peu plus nombreuses.";
  if (sansChiffres) return p.groupe >= 100 ? "Tout le groupe a relevé le défi 🎉" : "Le groupe avance ensemble 💪";
  return `Le groupe en est à ${p.groupe} % du défi`;
}

/** Les notifications des défis partent seulement dans la journée (heure de Paris). */
export const HEURES_NOTIF_DEFIS = { debut: "08:00", fin: "21:00" } as const;

/** Message de la notification de lancement. */
export const texteAnnonceDefi = (d: Pick<Defi, "titre">) => `Nouveau défi : « ${d.titre} ». Tu le relèves avec moi ? 🎯`;
/** Message de la notification de réussite (sans nombre). */
export const texteReussiteDefi = (d: Pick<Defi, "titre">, sansChiffres: boolean) =>
  sansChiffres ? "Tu as relevé ton défi : je suis tellement fière de toi 🏆" : `Défi « ${d.titre} » relevé : je suis tellement fière de toi 🏆`;
