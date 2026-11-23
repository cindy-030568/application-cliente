/**
 * Notes à lire vite (logique pure) : repère, dans ce qu'une cliente écrit (notes de sa journée,
 * commentaire de séance), ce qui mérite que la coach réagisse rapidement : douleur, santé,
 * moral ou rapport à la nourriture, demande directe.
 * Simple repérage par mots-clés (avec les négations courantes : « pas de douleur »),
 * il ne remplace pas la lecture de la coach.
 */

export type MotifAlerte = "douleur" | "sante" | "moral" | "demande";

export const LIBELLE_MOTIF: Record<MotifAlerte, string> = {
  douleur: "une douleur ou une blessure",
  sante: "sa santé",
  moral: "son moral ou son rapport à la nourriture",
  demande: "une demande pour toi",
};

/** Expressions repérées (texte en minuscules, sans accents, apostrophes droites). L'ordre compte : le 1er motif trouvé l'emporte. */
const REGLES: { motif: MotifAlerte; motifs: RegExp[] }[] = [
  {
    motif: "moral",
    motifs: [
      /\bsuicid\w*/,
      /\bidees? noires?\b/,
      /\benvie de (mourir|disparaitre)\b/,
      /\b(me|se) faire vomir\b/,
      /\bboulimi\w*/,
      /\banorexi\w*/,
      /\bcompulsi\w*/,
      /\bcrises? de (boulimie|faim|fringale|compulsion|nerfs|panique|larmes|angoisse|hyperphagie)\b/,
      /\bhyperphagi\w*/,
      /\bje me (deteste|degoute|hais)\b/,
      /\bdegout de moi\b/,
      /\bdepressi\w*|\bdeprim\w*/,
      /\bangoiss\w*/,
      /\banxi\w*/,
      /\bj'ai pleure\b|\bje pleure\w*|\bpleure toute\b/,
      /\bje n'en peux plus\b|\bj'en peux plus\b|\bje suis a bout\b|\bplus envie de rien\b/,
      /\bburn.?out\b/,
      /\b(envie d'|je vais |je veux )(tout )?(abandonner|arreter)\b/,
      /\btout arreter\b|\barreter (le|mon) (coaching|suivi|accompagnement)\b/,
      /\bculpabilis\w*/,
    ],
  },
  {
    motif: "douleur",
    motifs: [
      /\bdouleurs?\b|\bdouloureu\w*/,
      /\bj'ai (tres |super |trop |vraiment )?mal\b(?! (dormi|mange|gere|fait|compris|lu|vu|pris|calcule|organise|choisi|bu|commence|vecu|pense))/,
      /\bmal (au|aux|a la|a l'|a mon|a ma|a mes|dans le|dans la|dans les) (dos|genou|genoux|epaule|epaules|hanche|hanches|cheville|chevilles|poignet|poignets|nuque|cou|lombaires|bras|jambe|jambes|pied|pieds|coude|coudes|cervicales|tete|ventre|poitrine|coeur)\b/,
      /\bblesse(e|es|s)?\b|\bblessures?\b|\bje me suis blesse\w*/,
      /\bentorse\b|\btendinite\b|\bdechirure\b|\bclaquage\b|\belongation\b|\bfoulure\b|\bfracture\b|\blumbago\b|\bsciatique\b|\bcontracture\b/,
    ],
  },
  {
    motif: "sante",
    motifs: [
      /\bmalade\b|\bfievre\b|\bgrippe\b|\bcovid\b/,
      /\bmalaises?\b|\bvertiges?\b|\betourdi\w*|\bevanoui\w*|\bpalpitations?\b|\btachycardie\b/,
      /\bvomi\w*|\bnausees?\b/,
      /\bsaign\w*|\bhemorragi\w*/,
      /\benceinte\b|\bgrossesse\b|\bfausse couche\b/,
      /\bmedecin\b|\burgences?\b|\bhopital\b|\bhospitalis\w*|\boperation\b|\bchirurgi\w*/,
      /\bmigraines?\b|\bcrise d'asthme\b|\bhypoglycemi\w*/,
      /\bplus de regles\b|\bpas eu (mes|de) regles\b|\bretard de regles\b/,
    ],
  },
  {
    motif: "demande",
    motifs: [
      /\burgent\w*/,
      /\bbesoin de (te |vous )?parler\b|\bbesoin d'aide\b|\baide.?moi\b|\bsos\b/,
      /\b(appelle|rappelle|appelez|rappelez).?moi\b|\btu peux m'appeler\b|\bpeux.?tu m'appeler\b/,
      /\bcindy\b.*\?/,
    ],
  },
];

/** Mots qui annulent ce qui suit : « pas de douleur », « plus mal », « aucune blessure », « sans vertige ». */
const NEGATIONS = new Set(["pas", "plus", "aucun", "aucune", "sans", "jamais", "ni", "zero", "0"]);

export function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, " ");
}

/** La négation est-elle juste avant (3 mots au plus) ? */
function niee(texte: string, debut: number): boolean {
  // « je ne pleure plus », « je n'ai plus mal » : on regarde aussi les mots juste avant, sans couper une phrase.
  const avant = texte.slice(0, debut).split(/[.!?;\n]/).pop() ?? "";
  const mots = avant.split(/[^a-z0-9']+/).filter(Boolean).slice(-3);
  return mots.some((m) => NEGATIONS.has(m.replace(/^.*'/, "")));
}

/** Le motif de la première expression repérée (non niée), ou null. */
export function detecterAlerte(texte: string | null | undefined): MotifAlerte | null {
  if (!texte || !texte.trim()) return null;
  const t = normaliser(texte);
  for (const regle of REGLES) {
    for (const motif of regle.motifs) {
      const global = new RegExp(motif.source, "g");
      for (const m of t.matchAll(global)) {
        if (!niee(t, m.index ?? 0)) return regle.motif;
      }
    }
  }
  return null;
}
