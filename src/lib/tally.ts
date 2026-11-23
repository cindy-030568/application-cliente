/**
 * Formulaire Tally → demande d'inscription (logique pure, testée).
 * Les questions sont reconnues par leur intitulé (voir le guide) :
 * « Prénom », « Nom », « Email », « Objectif », et une question sur les allergies
 * ou aliments évités. Toutes les autres réponses sont gardées telles quelles pour la coach.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type ChampTally = {
  key?: string;
  label?: string | null;
  type?: string;
  value?: unknown;
  options?: { id: string; text: string }[];
};
export type Objectif = "perte" | "maintien" | "prise" | "recompo";
export type DemandeLue = {
  reference: string | null;
  prenom: string;
  nom: string;
  email: string;
  objectif: string | null;
  objectifCode: Objectif | null;
  exclusionsTexte: string | null;
  categoriesExclues: string[];
  reponses: { question: string; reponse: string }[];
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Minuscules, sans accents, « œ » → « oe », espaces simples. */
export function normaliser(t: string): string {
  return t.toLowerCase().replace(/œ/g, "oe").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
}

function egal(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Vérifie l'en-tête « Tally-Signature » : HMAC SHA256 du contenu reçu, avec la clé secrète
 * (« signing secret ») choisie dans Tally. Accepte l'encodage base64 (celui de Tally) ou hexadécimal.
 */
export function signatureTallyValide(corps: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const recue = Buffer.from(signature.trim());
  const candidats = [corps];
  try {
    candidats.push(JSON.stringify(JSON.parse(corps)));
  } catch {
    return false;
  }
  return candidats.some((c) => {
    const mac = createHmac("sha256", secret).update(c);
    const brut = mac.digest();
    return egal(recue, Buffer.from(brut.toString("base64"))) || egal(recue, Buffer.from(brut.toString("hex")));
  });
}

/** Réponse lisible d'un champ (les choix sont traduits en texte, les fichiers ne sont pas recopiés). */
export function texteReponse(champ: ChampTally): string {
  const v = champ.value;
  if (v === null || v === undefined || v === "") return "";
  const texteOption = (x: unknown) => champ.options?.find((o) => o.id === x)?.text ?? (typeof x === "string" ? x : "");
  if (Array.isArray(v)) {
    if (v.some((x) => x && typeof x === "object")) return "(fichier joint : à voir dans Tally)";
    return v.map(texteOption).filter(Boolean).join(", ");
  }
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return champ.options?.length ? texteOption(v) : v.trim();
  return "";
}

type Role = "prenom" | "nom" | "email" | "objectif" | "exclusions";

/** À quoi sert une question, d'après son intitulé. */
export function roleQuestion(champ: ChampTally): Role | null {
  const l = normaliser(champ.label ?? "");
  if (/\bpr[e]?nom\b|\bprenom\b|first name/.test(l)) return "prenom";
  if (champ.type === "INPUT_EMAIL" || /\be-?mail\b|\bcourriel\b|adresse mail/.test(l)) return "email";
  if (/\bnom\b|last name/.test(l)) return "nom";
  if (/\bobjectif/.test(l)) return "objectif";
  if (/allerg|intoleran|exclu|evites?\b|eviter|ne manges? pas|n'aimes? pas|ne supportes? pas|regime alimentaire|aversion/.test(l)) return "exclusions";
  return null;
}

/** Objectif reconnu dans la réponse libre, ou null si ce n'est pas clair (la coach choisit). */
export function objectifDepuis(texte: string): Objectif | null {
  const t = normaliser(texte);
  const trouves = new Set<Objectif>();
  if (/recompo|tonifi|raffermi|sculpt|dessiner/.test(t)) trouves.add("recompo");
  if (/perdre|perte|mincir|maigrir|affiner|kilos? en trop|poids en moins/.test(t)) trouves.add("perte");
  if (/prise de masse|prendre (du|de la) (poids|masse|muscle)|grossir/.test(t)) trouves.add("prise");
  if (/maintenir|maintien|stabiliser|garder mon poids|equilibre/.test(t)) trouves.add("maintien");
  if (trouves.has("recompo")) return "recompo";
  return trouves.size === 1 ? [...trouves][0] : null;
}

/** Synonymes → noms de catégories d'exclusion (comparés sans accents). */
const SYNONYMES: [RegExp, string[]][] = [
  [/vegan|vegetalien/, ["viande", "porc", "volaille", "poisson", "fruits de mer", "oeuf", "produits laitiers"]],
  [/vegetarien|pas de viande|sans viande/, ["viande", "porc", "volaille", "poisson", "fruits de mer"]],
  [/porc|halal|casher|jambon/, ["porc"]],
  [/lactose|laitier|\blait\b|fromage|yaourt/, ["produits laitiers"]],
  [/gluten|coeliaqu|celiaqu|ble\b/, ["gluten"]],
  [/noix|amande|noisette|cajou|pistache|fruits? a coque/, ["fruits a coque"]],
  [/arachide|cacahu/, ["arachide"]],
  [/crustace|crevette|moule|fruits de mer|coquillage/, ["fruits de mer"]],
  [/poisson/, ["poisson"]],
  [/\boeufs?\b/, ["oeuf"]],
  [/\bsoja\b/, ["soja"]],
  [/sesame/, ["sesame"]],
  [/volaille|poulet|dinde/, ["volaille"]],
];

/** Catégories d'exclusion proposées d'après la réponse (la coach vérifie avant de les appliquer). */
export function categoriesDepuis(texte: string, categories: { id: string; nom: string }[]): string[] {
  const t = normaliser(texte);
  if (!t || /^(non|aucune?|rien|ras|nope|-)\.?$/.test(t)) return [];
  const noms = new Set<string>();
  for (const [motif, cibles] of SYNONYMES) if (motif.test(t)) cibles.forEach((c) => noms.add(c));
  const ids: string[] = [];
  for (const c of categories) {
    const n = normaliser(c.nom);
    if (noms.has(n) || new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`).test(t)) ids.push(c.id);
  }
  return ids;
}

/** Lit l'envoi Tally (événement « FORM_RESPONSE »). */
export function lireReponseTally(payload: unknown, categories: { id: string; nom: string }[]): DemandeLue | { erreur: string } {
  const p = payload as { eventType?: string; data?: { responseId?: string; submissionId?: string; fields?: ChampTally[] } } | null;
  if (!p || p.eventType !== "FORM_RESPONSE" || !Array.isArray(p.data?.fields)) return { erreur: "Ce n’est pas une réponse de formulaire Tally." };
  const valeurs: Partial<Record<Role, string>> = {};
  const reponses: DemandeLue["reponses"] = [];
  for (const champ of p.data.fields.slice(0, 200)) {
    const reponse = texteReponse(champ).slice(0, 2000);
    const question = String(champ.label ?? "").trim().slice(0, 300);
    const role = roleQuestion(champ);
    if (role && reponse && !valeurs[role]) valeurs[role] = reponse;
    else if (role === "exclusions" && reponse) valeurs.exclusions = `${valeurs.exclusions}, ${reponse}`;
    if (question && reponse && role !== "prenom" && role !== "nom" && role !== "email") reponses.push({ question, reponse });
  }
  const email = (valeurs.email ?? "").trim().toLowerCase();
  const prenom = (valeurs.prenom ?? "").trim().slice(0, 60);
  if (!EMAIL.test(email) || email.length > 200) return { erreur: "Pas d’email valide dans la réponse (une question « Email » est nécessaire)." };
  if (!prenom) return { erreur: "Pas de prénom dans la réponse (une question « Prénom » est nécessaire)." };
  const objectif = valeurs.objectif?.slice(0, 500) ?? null;
  const exclusionsTexte = valeurs.exclusions?.slice(0, 1000) ?? null;
  return {
    reference: String(p.data.responseId ?? p.data.submissionId ?? "").slice(0, 100) || null,
    prenom,
    nom: (valeurs.nom ?? "").trim().slice(0, 80),
    email,
    objectif,
    objectifCode: objectif ? objectifDepuis(objectif) : null,
    exclusionsTexte,
    categoriesExclues: exclusionsTexte ? categoriesDepuis(exclusionsTexte, categories) : [],
    reponses,
  };
}
