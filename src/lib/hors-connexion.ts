/**
 * Séance sans réseau (côté téléphone) : file d'attente des séances validées et des poids notés
 * hors connexion, envoi au retour du réseau, et effacement complet à la déconnexion.
 * Seuls le programme sportif et la séance guidée sont gardés sur le téléphone (voir public/sw.js).
 */

export const CLE_FILE = "fitw_hors_connexion_file";
export const CLE_PROPRIETAIRE = "fitw_hors_connexion_proprietaire";
/** Caches du service worker (à garder identiques à public/sw.js). */
export const CACHES_HORS_CONNEXION = ["fitw-sport-v1", "fitw-statique-v1"];
export const EVENEMENT_FILE = "fitw-file-change";

export type ElementFile =
  | {
      id: string;
      type: "seance";
      programmeId: string;
      seance: number;
      nom: string;
      infos: { dureeMinutes: number | null; ressenti: number | null; commentaire: string };
      ref: string;
      faiteLe: string;
    }
  | { id: string; type: "charges"; programmeId: string; ref: string; lignes: { exercice: string; serie: number; kg: number }[] };

type Stockage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const stockageParDefaut = (): Stockage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

export function lireFile(stockage: Stockage | null = stockageParDefaut()): ElementFile[] {
  try {
    const brut = stockage?.getItem(CLE_FILE);
    const file = brut ? JSON.parse(brut) : [];
    return Array.isArray(file) ? file : [];
  } catch {
    return [];
  }
}

function ecrireFile(file: ElementFile[], stockage: Stockage | null) {
  try {
    if (file.length) stockage?.setItem(CLE_FILE, JSON.stringify(file.slice(-200)));
    else stockage?.removeItem(CLE_FILE);
  } catch {
    // stockage plein ou indisponible
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENEMENT_FILE));
}

/**
 * Ajoute un élément. Une même séance (même `ref`) n'est gardée qu'une fois ;
 * les poids d'une même série sont fusionnés (le dernier saisi l'emporte).
 */
export function fusionner(file: ElementFile[], e: ElementFile): ElementFile[] {
  if (e.type === "seance") return [...file.filter((x) => !(x.type === "seance" && x.ref === e.ref)), e];
  const existant = file.find((x): x is Extract<ElementFile, { type: "charges" }> => x.type === "charges" && x.ref === e.ref && x.programmeId === e.programmeId);
  if (!existant) return [...file, e];
  const lignes = [...existant.lignes.filter((l) => !e.lignes.some((m) => m.exercice === l.exercice && m.serie === l.serie)), ...e.lignes];
  return file.map((x) => (x === existant ? { ...existant, lignes } : x));
}

export function ajouterAFile(e: ElementFile, stockage: Stockage | null = stockageParDefaut()) {
  ecrireFile(fusionner(lireFile(stockage), e), stockage);
}

/** Retire les éléments enregistrés (ou refusés pour de bon) par le serveur. */
export function retirerDeFile(ids: string[], stockage: Stockage | null = stockageParDefaut()) {
  if (!ids.length) return;
  ecrireFile(
    lireFile(stockage).filter((x) => !ids.includes(x.id)),
    stockage,
  );
}

export const nouvelId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Vrai si l'erreur ressemble à une coupure de réseau (et non à un refus du serveur). */
export function estCoupureReseau(erreur: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return erreur instanceof TypeError || /fetch|network|réseau|load failed/i.test(String((erreur as Error)?.message ?? ""));
}

let envoiEnCours: Promise<number> | null = null;

/** Envoie la file au serveur. Renvoie le nombre d'éléments encore en attente. */
export function synchroniser(): Promise<number> {
  if (envoiEnCours) return envoiEnCours;
  envoiEnCours = (async () => {
    const file = lireFile();
    if (!file.length) return 0;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return file.length;
    try {
      const r = await fetch("/api/sport/synchroniser", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ elements: file }),
      });
      if (!r.ok) return file.length;
      const { enregistres = [], refuses = [] } = (await r.json()) as { enregistres?: string[]; refuses?: string[] };
      retirerDeFile([...enregistres, ...refuses]);
    } catch {
      // toujours pas de réseau : on réessaiera
    }
    return lireFile().length;
  })().finally(() => {
    envoiEnCours = null;
  });
  return envoiEnCours;
}

/** Efface tout ce qui est gardé sur le téléphone pour la séance hors connexion (déconnexion, autre compte). */
export async function effacerHorsConnexion(stockage: Stockage | null = stockageParDefaut()) {
  try {
    stockage?.removeItem(CLE_FILE);
    stockage?.removeItem(CLE_PROPRIETAIRE);
  } catch {
    // rien à effacer
  }
  try {
    if (typeof caches !== "undefined") await Promise.all(CACHES_HORS_CONNEXION.map((c) => caches.delete(c)));
  } catch {
    // caches indisponibles (navigation privée)
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENEMENT_FILE));
}

/** Si un autre compte s'est connecté sur ce téléphone, on efface ce qui appartenait au précédent. */
export async function verifierProprietaire(id: string, stockage: Stockage | null = stockageParDefaut()) {
  let ancien: string | null = null;
  try {
    ancien = stockage?.getItem(CLE_PROPRIETAIRE) ?? null;
  } catch {
    return;
  }
  if (ancien && ancien !== id) await effacerHorsConnexion(stockage);
  try {
    stockage?.setItem(CLE_PROPRIETAIRE, id);
  } catch {
    // stockage indisponible
  }
}

/** Adresses des fichiers techniques (scripts, styles) d'une page, pour les garder aussi sur le téléphone. */
export function ressourcesDePage(html: string): string[] {
  const urls = new Set<string>();
  for (const m of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) urls.add(m[1]);
  return [...urls];
}
