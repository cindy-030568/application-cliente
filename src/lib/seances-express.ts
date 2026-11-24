/**
 * Séances express (séances de secours à la carte) : logique pure, testée.
 * Même format qu'une séance de programme (blocs, exercices, séries, repos, AMRAP / EMOM / Tabata),
 * pour être jouée dans le mode séance guidée existant.
 */
import { CONSIGNE_CLAUDE, extraireProgramme, lireProgramme, type Seance } from "./programme-sportif";

export const DUREES_EXPRESS = [5, 10, 15, 20, 30] as const;
export type DureeExpress = (typeof DUREES_EXPRESS)[number];

export const NIVEAUX_EXPRESS = [
  { code: "tous", libelle: "Tous niveaux" },
  { code: "debutante", libelle: "Débutante" },
  { code: "intermediaire", libelle: "Intermédiaire" },
  { code: "confirmee", libelle: "Confirmée" },
] as const;
export type NiveauExpress = (typeof NIVEAUX_EXPRESS)[number]["code"];
export const libelleNiveau = (code: string) => NIVEAUX_EXPRESS.find((n) => n.code === code)?.libelle ?? code;

export type SeanceExpress = {
  id: string;
  titre: string;
  description: string | null;
  duree_minutes: number;
  materiel: string[];
  type: string;
  niveau: NiveauExpress;
  contenu: Seance;
  publiee: boolean;
  visibilite: "toutes" | "certaines";
};

/** Le contenu gardé en base, relu et nettoyé (même validation que les programmes). */
export function lireContenuExpress(v: unknown, titre = "Séance express"): Seance | null {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  if (!o) return null;
  return lireProgramme({ seances: [{ nom: titre, ...o }] }).seances[0] ?? null;
}

/**
 * Retrouve UNE séance dans la réponse de Claude collée telle quelle : un objet séance
 * (avec « blocs »), ou un programme dont on prend la première séance.
 */
export function extraireSeance(colle: string): { seance: Seance; erreur?: undefined } | { seance?: undefined; erreur: string } {
  const brut = colle.trim();
  if (!brut) return { erreur: "Colle d’abord la réponse de Claude." };
  const bloc = brut.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? brut;
  const debut = bloc.indexOf("{");
  const fin = bloc.lastIndexOf("}");
  if (debut >= 0 && fin > debut) {
    try {
      const v = JSON.parse(bloc.slice(debut, fin + 1).replace(/[“”]/g, '"')) as Record<string, unknown>;
      if (v && typeof v === "object" && !Array.isArray(v) && !Array.isArray(v.seances)) {
        const s = lireProgramme({ seances: [v] }).seances[0];
        if (s) return { seance: s };
        return { erreur: "La séance ne contient aucun bloc avec des exercices." };
      }
    } catch {
      // On laisse la lecture « programme » donner le bon message d'erreur.
    }
  }
  const r = extraireProgramme(colle);
  if (!r.programme) return { erreur: r.erreur };
  return { seance: r.programme.seances[0] };
}

/** La cliente a-t-elle accès aux séances express ? (même règle que la base : acces_seances_express) */
export function accesExpress(f: { statut: string; express_jusqu_au?: string | null }, aujourdhui: string): boolean {
  if (f.statut === "active") return true;
  return f.statut === "terminee" && Boolean(f.express_jusqu_au) && f.express_jusqu_au! >= aujourdhui;
}

export type FiltresExpress = { duree: number | null; materiel: string | null; type: string | null; favoris: boolean };

/** Lit les filtres de l'adresse (?duree=10&materiel=Tapis&type=Cardio&favoris=1). */
export function lireFiltres(p: { duree?: string; materiel?: string; type?: string; favoris?: string }): FiltresExpress {
  const d = Number(p.duree);
  return {
    duree: (DUREES_EXPRESS as readonly number[]).includes(d) ? d : null,
    materiel: p.materiel?.trim().slice(0, 40) || null,
    type: p.type?.trim().slice(0, 40) || null,
    favoris: p.favoris === "1",
  };
}

/**
 * Filtre la bibliothèque. Matériel : « Aucun » = séances sans matériel ; sinon, les séances
 * faisables avec ce matériel (celles qui n'en demandent pas comprises).
 */
export function filtrerExpress<T extends Pick<SeanceExpress, "id" | "duree_minutes" | "materiel" | "type">>(liste: T[], f: FiltresExpress, favoris: Set<string>): T[] {
  const sansMateriel = (s: T) => !s.materiel.length || s.materiel.every((m) => m.toLowerCase() === "aucun");
  return liste.filter(
    (s) =>
      (!f.duree || s.duree_minutes === f.duree) &&
      (!f.type || s.type === f.type) &&
      (!f.materiel || (f.materiel.toLowerCase() === "aucun" ? sansMateriel(s) : sansMateriel(s) || s.materiel.includes(f.materiel))) &&
      (!f.favoris || favoris.has(s.id)),
  );
}

/** Une liste modifiable dans Réglages (une valeur par ligne), sans doublon ni ligne vide. */
export function lireListe(texte: string, max = 30): string[] {
  const vus = new Set<string>();
  return texte
    .split(/\r?\n/)
    .map((l) => l.trim().slice(0, 40))
    .filter((l) => l && !vus.has(l.toLowerCase()) && vus.add(l.toLowerCase()))
    .slice(0, max);
}

/** Consigne à coller dans Claude pour écrire (ou retranscrire) UNE séance express. */
export const CONSIGNE_SEANCE_EXPRESS = `${CONSIGNE_CLAUDE}

---

CETTE FOIS, il ne s’agit pas d’un programme mais d’UNE séance courte « de secours » (5 à 30 minutes), pour les jours où ma cliente ne peut pas faire son programme : déplacement, peu de temps, pas de salle. Elle se fait souvent à la maison, avec peu ou pas de matériel.

Si je te donne une séance déjà écrite (PDF, photo ou texte), retranscris-la FIDÈLEMENT. Sinon, construis-la avec moi.

Quand je te dis « format application », réponds avec UNE SEULE séance (pas un programme) dans un bloc de code JSON, sans rien d’autre, avec exactement les champs d’une séance : nom, jour (null), duree, echauffement, blocs, retour_au_calme, notes. Pas de champ « seances », pas de titre de programme.`;

/** Message tout prêt : consigne + demande, à coller avec la séance (PDF ou texte) jointe. */
export const DEMANDE_SEANCE_EXPRESS = `${CONSIGNE_SEANCE_EXPRESS}

---

Voici la séance (PDF ou texte ci-dessous). Retranscris-la FIDÈLEMENT au format application : une seule séance, un seul bloc de code JSON, et rien d’autre (pas d’artefact, pas d’application).`;
