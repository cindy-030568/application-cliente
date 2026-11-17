/**
 * Programme sportif construit avec Claude (logique pure).
 * La coach copie la consigne dans Claude, construit le programme avec lui, puis colle
 * sa réponse dans l'app : on y retrouve le JSON, on le vérifie et on le nettoie.
 */

export type Exercice = {
  nom: string;
  series: string | null;
  repetitions: string | null;
  charge: string | null;
  repos: string | null;
  tempo: string | null;
  consignes: string | null;
};
export type Bloc = { titre: string | null; format: string | null; exercices: Exercice[] };
export type Seance = {
  nom: string;
  jour: string | null;
  duree: string | null;
  echauffement: string | null;
  blocs: Bloc[];
  retour_au_calme: string | null;
  notes: string | null;
};
export type Programme = {
  titre: string | null;
  duree: string | null;
  frequence: string | null;
  seances: Seance[];
  conseils: string | null;
};

export const LIMITES_PROGRAMME = { seances: 14, blocs: 12, exercices: 30 };

const texte = (v: unknown, max: number): string | null => {
  if (typeof v === "number" && Number.isFinite(v)) return String(v).replace(".", ",");
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t || null;
};
const liste = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const objet = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

function lireExercice(v: unknown): Exercice | null {
  const o = objet(v);
  const nom = o && texte(o.nom, 120);
  if (!o || !nom) return null;
  return {
    nom,
    series: texte(o.series, 40),
    repetitions: texte(o.repetitions, 60),
    charge: texte(o.charge, 80),
    repos: texte(o.repos, 40),
    tempo: texte(o.tempo, 40),
    consignes: texte(o.consignes, 600),
  };
}

function lireBloc(v: unknown): Bloc | null {
  const o = objet(v);
  if (!o) return null;
  const exercices = liste(o.exercices, LIMITES_PROGRAMME.exercices).flatMap((e) => (lireExercice(e) ? [lireExercice(e)!] : []));
  const titre = texte(o.titre, 80);
  const format = texte(o.format, 120);
  if (!exercices.length && !titre && !format) return null;
  return { titre, format, exercices };
}

function lireSeance(v: unknown, i: number): Seance | null {
  const o = objet(v);
  if (!o) return null;
  const blocs = liste(o.blocs, LIMITES_PROGRAMME.blocs).flatMap((b) => (lireBloc(b) ? [lireBloc(b)!] : []));
  // Tolérance : une séance avec « exercices » directement (sans blocs) devient un bloc unique.
  if (!blocs.length && Array.isArray(o.exercices)) {
    const b = lireBloc({ exercices: o.exercices });
    if (b) blocs.push(b);
  }
  if (!blocs.length) return null;
  return {
    nom: texte(o.nom, 100) ?? `Séance ${i + 1}`,
    jour: texte(o.jour, 40),
    duree: texte(o.duree, 40),
    echauffement: texte(o.echauffement, 1500),
    blocs,
    retour_au_calme: texte(o.retour_au_calme, 1500),
    notes: texte(o.notes, 1500),
  };
}

/** Valide et nettoie un programme (venant de Claude, du navigateur ou de la base). */
export function lireProgramme(v: unknown): Programme {
  const o = objet(v) ?? {};
  return {
    titre: texte(o.titre, 100),
    duree: texte(o.duree, 60),
    frequence: texte(o.frequence, 60),
    seances: liste(o.seances, LIMITES_PROGRAMME.seances).flatMap((s, i) => (lireSeance(s, i) ? [lireSeance(s, i)!] : [])),
    conseils: texte(o.conseils, 5000),
  };
}

export type ResultatImport = { programme: Programme; erreur?: undefined } | { programme?: undefined; erreur: string };

/** Retrouve le programme dans la réponse de Claude collée telle quelle (avec ou sans ```json). */
export function extraireProgramme(colle: string): ResultatImport {
  const brut = colle.trim();
  if (!brut) return { erreur: "Colle d’abord la réponse de Claude." };
  const bloc = brut.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? brut;
  const debut = bloc.indexOf("{");
  const fin = bloc.lastIndexOf("}");
  if (debut < 0) {
    return { erreur: "Je ne trouve pas de programme dans ce texte. Demande à Claude de répondre « au format application »." };
  }
  const incomplet = "Le programme est incomplet ou abîmé (copie coupée ?). Recopie toute la réponse de Claude, jusqu’à la dernière accolade }.";
  if (fin <= debut) return { erreur: incomplet };
  // Guillemets « typographiques » qu'un copier-coller peut introduire autour des clés.
  const json = bloc.slice(debut, fin + 1).replace(/[“”]/g, '"');
  let donnees: unknown;
  try {
    donnees = JSON.parse(json);
  } catch {
    return { erreur: incomplet };
  }
  const programme = lireProgramme(donnees);
  if (!programme.seances.length) return { erreur: "Le programme ne contient aucune séance avec des exercices." };
  return { programme };
}

export function compterExercices(p: Programme): number {
  return p.seances.reduce((n, s) => n + s.blocs.reduce((m, b) => m + b.exercices.length, 0), 0);
}

/** « 4 × 10 » ; « 3 × 30 s » ; « 12 » ; null. */
export function volume(e: Pick<Exercice, "series" | "repetitions">): string | null {
  if (e.series && e.repetitions) return `${e.series} × ${e.repetitions}`;
  return e.repetitions ?? (e.series ? `${e.series} séries` : null);
}

/** Exemple montré à Claude : sert aussi de modèle de format. */
const EXEMPLE: Programme = {
  titre: "Remise en forme – 4 semaines",
  duree: "4 semaines",
  frequence: "3 séances par semaine",
  seances: [
    {
      nom: "Séance A – Bas du corps",
      jour: "Lundi",
      duree: "50 min",
      echauffement: "5 min rameur facile, puis 2 tours : 10 squats au poids du corps, 10 fentes arrière, 30 s de gainage",
      blocs: [
        {
          titre: "Force",
          format: "4 séries",
          exercices: [
            { nom: "Goblet squat", series: "4", repetitions: "10", charge: "kettlebell 12 à 16 kg", repos: "90 s", tempo: "3-1-1", consignes: "Poitrine haute, genoux dans l’axe des pieds" },
          ],
        },
        {
          titre: "Metcon",
          format: "AMRAP 10 min",
          exercices: [
            { nom: "Wall ball", series: null, repetitions: "12", charge: "6 kg", repos: null, tempo: null, consignes: null },
            { nom: "Rameur", series: null, repetitions: "12 calories", charge: null, repos: null, tempo: null, consignes: "Rythme régulier" },
          ],
        },
      ],
      retour_au_calme: "Étirements des hanches et des ischios, 5 min",
      notes: null,
    },
  ],
  conseils: "Bois au moins 1,5 L d’eau les jours d’entraînement. Augmente la charge quand les dernières répétitions deviennent faciles.",
};

/** Consigne à coller dans Claude (ou dans les instructions d'un projet Claude). */
export const CONSIGNE_CLAUDE = `Tu m’aides à construire des programmes sportifs pour mes clientes (je suis coach, je travaille en box de CrossFit). Je te décris la cliente (objectif, niveau, matériel, nombre de séances, contraintes) ; tu me proposes un programme, on l’ajuste ensemble, puis je l’importe dans mon application.

Quand je te dis « format application » (ou quand le programme est validé), réponds avec le programme COMPLET dans un seul bloc de code JSON, sans rien d’autre, exactement avec cette structure :
- titre, duree, frequence, conseils : texte (ou null)
- seances : liste de séances avec nom, jour (ou null), duree (ou null), echauffement (texte ou null), blocs, retour_au_calme (ou null), notes (ou null)
- blocs : liste avec titre (ex. « Force », « Metcon »), format (ex. « 4 séries », « EMOM 12 min », « AMRAP 10 min », « For time », « 3 tours ») et exercices
- exercices : nom, series, repetitions (ex. « 10 », « 8-12 », « 30 s », « 12 calories »), charge, repos, tempo, consignes — tout en texte, null si sans objet

Écris en français, tutoie la cliente dans les consignes et les conseils, sans son nom. Exemple du format :

\`\`\`json
${JSON.stringify(EXEMPLE, null, 2)}
\`\`\``;

/** Texte à coller dans Claude pour faire modifier un programme existant. */
export function texteModification(p: Programme): string {
  return `Voici le programme actuel de ma cliente, au format de mon application. Je vais te dire ce qu’il faut modifier ; renvoie ensuite le programme COMPLET dans un seul bloc de code JSON, avec exactement la même structure.

\`\`\`json
${JSON.stringify(p, null, 2)}
\`\`\`

Modifications à faire : `;
}

/** Normalisation pour rapprocher un exercice d'une vidéo de la bibliothèque (même titre, sans accents ni casse). */
export function cleExercice(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/gi, "oe")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
