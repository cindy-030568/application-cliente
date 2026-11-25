/**
 * Ressources (logique pure, testée) : recherche sans accents ni majuscules, filtres
 * (catégorie, « À écouter », favoris), audios (formats acceptés, taille, durée) et reprise de l'écoute.
 * La sécurité ne dépend pas d'ici : la base (RLS) ne renvoie que les ressources faites pour la cliente.
 */

/** 50 Mo par fichier (comme le stockage « audios » de la base, 0043). */
export const AUDIO_MAX_OCTETS = 50 * 1024 * 1024;
/** Lien temporaire d'un audio : assez long pour une écoute complète, même écran verrouillé. */
export const DUREE_LIEN_AUDIO_S = 3 * 60 * 60;
/** Vitesses proposées dans le lecteur. */
export const VITESSES = [1, 1.25, 1.5] as const;
/** On saute de 15 secondes en arrière ou en avant. */
export const SAUT_S = 15;

const FORMATS: { ext: string; types: string[] }[] = [
  { ext: "m4a", types: ["audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac"] },
  { ext: "mp3", types: ["audio/mpeg", "audio/mp3"] },
  { ext: "webm", types: ["audio/webm"] },
];

/** Extension et type à utiliser pour un fichier audio, ou null s'il n'est pas accepté. */
export function formatAudio(nom: string, type: string): { ext: string; type: string } | null {
  const t = type.split(";")[0].trim().toLowerCase();
  const ext = nom.toLowerCase().match(/\.(m4a|mp3|mp4|aac|webm)$/)?.[1];
  const parType = FORMATS.find((f) => f.types.includes(t));
  if (parType) return { ext: parType.ext, type: parType.ext === "m4a" ? "audio/mp4" : parType.types[0] };
  if (ext === "m4a" || ext === "mp4" || ext === "aac") return { ext: "m4a", type: "audio/mp4" };
  if (ext === "mp3") return { ext: "mp3", type: "audio/mpeg" };
  if (ext === "webm") return { ext: "webm", type: "audio/webm" };
  return null;
}

/** Chemin d'un audio dans le stockage : <uuid>.<ext> (vérifié aussi par la base). */
export const CHEMIN_AUDIO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(m4a|mp3|mp4|aac|webm)$/;

/** 754 s → « 12 min », 45 s → « 1 min », 3 725 s → « 1 h 02 ». */
export function dureeCourte(s: number | null | undefined): string | null {
  if (!s || s <= 0) return null;
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

/** 75 → « 1:15 », 3725 → « 1:02:05 ». */
export function horloge(s: number): string {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Position de départ : on reprend où elle s'est arrêtée, sauf si c'était fini (ou presque) ou tout au début. */
export function positionDeReprise(e: { position_s: number; terminee: boolean } | null, duree: number | null): number {
  if (!e || e.terminee || e.position_s < 5) return 0;
  if (duree && e.position_s >= duree - 5) return 0;
  return e.position_s;
}

/** Fini quand il reste moins de 10 secondes (ou 97 %). */
export const estTerminee = (position: number, duree: number) => duree > 0 && (duree - position <= 10 || position / duree >= 0.97);

/** Texte sans accents, en minuscules, espaces simplifiés : « Évite » et « evite » se trouvent. */
export function normaliser(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[œ]/g, "oe")
    .replace(/[æ]/g, "ae")
    .replace(/[’']/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type RessourceCherchable = {
  id: string;
  titre: string;
  description: string | null;
  contenu?: string | null;
  categorie_id: string | null;
  audio_path?: string | null;
};

/** Tous les mots cherchés doivent apparaître (titre, description ou texte de la fiche), dans n'importe quel ordre. */
export function correspond(r: RessourceCherchable, recherche: string): boolean {
  const mots = normaliser(recherche).split(" ").filter(Boolean);
  if (!mots.length) return true;
  const texte = normaliser([r.titre, r.description ?? "", r.contenu ?? ""].join(" "));
  return mots.every((m) => texte.includes(m));
}

/** Les plus pertinentes d'abord : le titre compte plus que la description, qui compte plus que le texte. */
function score(r: RessourceCherchable, recherche: string): number {
  const mots = normaliser(recherche).split(" ").filter(Boolean);
  const titre = normaliser(r.titre);
  const desc = normaliser(r.description ?? "");
  return mots.reduce((s, m) => s + (titre.includes(m) ? 3 : desc.includes(m) ? 2 : 1), 0);
}

export type FiltresRessources = { q: string; categorie: string | null; ecouter: boolean; favoris: boolean };

/** Lit les filtres de l'adresse (?q=…&categorie=…&ecouter=1&favoris=1). */
export function lireFiltresRessources(p: { q?: string; categorie?: string; ecouter?: string; favoris?: string }): FiltresRessources {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return {
    q: (p.q ?? "").trim().slice(0, 80),
    categorie: p.categorie === "autres" ? "autres" : p.categorie && uuid.test(p.categorie) ? p.categorie : null,
    ecouter: p.ecouter === "1",
    favoris: p.favoris === "1",
  };
}

export function filtrerRessources<T extends RessourceCherchable>(liste: T[], f: FiltresRessources, favoris: Set<string>): T[] {
  const r = liste.filter(
    (x) =>
      (!f.categorie || (f.categorie === "autres" ? x.categorie_id === null : x.categorie_id === f.categorie)) &&
      (!f.ecouter || Boolean(x.audio_path)) &&
      (!f.favoris || favoris.has(x.id)) &&
      correspond(x, f.q),
  );
  return f.q ? [...r].sort((a, b) => score(b, f.q) - score(a, f.q) || a.titre.localeCompare(b.titre, "fr")) : r;
}

/** Un court extrait autour du premier mot trouvé dans le texte de la fiche (pour montrer pourquoi elle sort). */
export function extrait(contenu: string | null | undefined, recherche: string, autour = 60): string | null {
  if (!contenu) return null;
  const mot = normaliser(recherche).split(" ").filter(Boolean)[0];
  if (!mot) return null;
  // Texte sans la mise en forme (##, **, -).
  const brut = contenu.replace(/^#+\s*/gm, "").replace(/\*\*/g, "").replace(/^\s*-\s+/gm, "").replace(/\s+/g, " ").trim();
  const i = normaliser(brut).indexOf(mot);
  if (i < 0) return null;
  // normaliser garde la longueur des caractères accentués (NFD puis retrait des accents) sauf œ/æ : approximation suffisante.
  const debut = Math.max(0, i - autour);
  const fin = Math.min(brut.length, i + mot.length + autour);
  return `${debut > 0 ? "…" : ""}${brut.slice(debut, fin).trim()}${fin < brut.length ? "…" : ""}`;
}
