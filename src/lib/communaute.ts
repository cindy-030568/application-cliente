/** Communauté : constantes et fonctions pures (partagées serveur / navigateur, testées). */

export const REACTIONS = {
  coeur: { emoji: "❤️", label: "J’adore" },
  bravo: { emoji: "👏", label: "Bravo" },
  force: { emoji: "💪", label: "Courage" },
  rire: { emoji: "😂", label: "Trop drôle" },
} as const;
export type Reaction = keyof typeof REACTIONS;
export const LISTE_REACTIONS = Object.keys(REACTIONS) as Reaction[];
export const estReaction = (x: unknown): x is Reaction => typeof x === "string" && x in REACTIONS;

export const TEXTE_MAX = 2000;
export const PAR_PAGE = 30;
/** Au plus une notification « nouveau message » par heure et par membre. */
export const INTERVALLE_NOTIF_MS = 60 * 60 * 1000;

export type MessageCommunaute = {
  id: string;
  auteurId: string;
  prenom: string;
  coach: boolean;
  texte: string;
  photo: string | null;
  epingle: boolean;
  creeLe: string;
  reactions: Record<Reaction, number>;
  miennes: Reaction[];
  signale?: boolean;
};

type LigneReaction = { message_id: string; auteur_id: string; emoji: string };

/** Compte les réactions par message et repère celles de l'utilisatrice. */
export function regrouperReactions(lignes: LigneReaction[], moi: string) {
  const parMessage = new Map<string, { reactions: Record<Reaction, number>; miennes: Reaction[] }>();
  for (const l of lignes) {
    if (!estReaction(l.emoji)) continue;
    let r = parMessage.get(l.message_id);
    if (!r) {
      r = { reactions: { coeur: 0, bravo: 0, force: 0, rire: 0 }, miennes: [] };
      parMessage.set(l.message_id, r);
    }
    r.reactions[l.emoji]++;
    if (l.auteur_id === moi) r.miennes.push(l.emoji);
  }
  return parMessage;
}

/** Chemin d'une photo de la communauté : <id de l'autrice>/<uuid>.jpg */
export const PHOTO_COMMUNAUTE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;
export function photoDe(chemin: string, auteur: string) {
  const m = PHOTO_COMMUNAUTE.exec(chemin);
  return Boolean(m && m[1] === auteur);
}

/** Texte nettoyé : espaces en trop retirés, 3 sauts de ligne max d'affilée, longueur bornée. */
export function nettoyerTexte(brut: string) {
  return brut
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, TEXTE_MAX);
}

/** « à l'instant », « il y a 5 min », « il y a 3 h », « hier à 18:02 », « 12 nov. à 9:30 ». */
export function momentRelatif(iso: string, maintenant: Date) {
  const d = new Date(iso);
  const ecart = maintenant.getTime() - d.getTime();
  if (ecart < 60_000) return "à l’instant";
  if (ecart < 3_600_000) return `il y a ${Math.floor(ecart / 60_000)} min`;
  const jour = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(x);
  const heure = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(d);
  if (jour(d) === jour(maintenant)) return ecart < 6 * 3_600_000 ? `il y a ${Math.floor(ecart / 3_600_000)} h` : `aujourd’hui à ${heure}`;
  const hier = new Date(maintenant.getTime() - 86_400_000);
  if (jour(d) === jour(hier)) return `hier à ${heure}`;
  const memeAnnee = jour(d).slice(0, 4) === jour(maintenant).slice(0, 4);
  const date = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
    year: memeAnnee ? undefined : "numeric",
  }).format(d);
  return `${date} à ${heure}`;
}

/** Peut-on notifier ce membre maintenant ? (activé, pas déjà notifiée dans l'heure, pas venue depuis le message). */
export function notificationPermise(
  m: { notifications: boolean; derniere_notif: string | null; dernier_vu: string },
  maintenant: Date,
) {
  if (!m.notifications) return false;
  if (m.derniere_notif && maintenant.getTime() - new Date(m.derniere_notif).getTime() < INTERVALLE_NOTIF_MS) return false;
  // Venue il y a moins de 2 minutes : elle est probablement en train de lire.
  if (maintenant.getTime() - new Date(m.dernier_vu).getTime() < 2 * 60_000) return false;
  return true;
}

/** Les messages épinglés d'abord (du plus récent au plus ancien), puis le reste. */
export function ordonner<T extends { epingle: boolean; creeLe: string }>(messages: T[]) {
  return [...messages].sort((a, b) =>
    a.epingle !== b.epingle ? (a.epingle ? -1 : 1) : b.creeLe.localeCompare(a.creeLe),
  );
}

/** Jour (AAAA-MM-JJ) à Paris d'un instant ISO. */
export const jourParis = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(iso));
