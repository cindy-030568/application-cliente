/**
 * Texte d'un bilan à coller dans Claude pour préparer une réponse.
 * Pseudonymisé : ni nom, ni email, ni photo, ni date précise ; le prénom est
 * aussi retiré des réponses libres. La coach relit avant d'envoyer.
 */
import { joursEntre } from "@/lib/bilan";
import { libelleChamp, parSection } from "@/lib/champs";
import type { Bilan, ChampMesure } from "@/lib/types";

const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const ecartFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2, signDisplay: "exceptZero" });

/** Remplace le prénom et le nom (mots entiers, sans tenir compte des majuscules) par « [prénom] ». */
export function masquerIdentite(texte: string, noms: string[]): string {
  let t = texte;
  for (const n of noms.map((x) => x.trim()).filter((x) => x.length >= 2)) {
    const motif = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp(`(?<![\\p{L}])${motif}(?![\\p{L}])`, "giu"), "[prénom]");
  }
  return t;
}

function valeur(c: ChampMesure, b: Bilan): string | null {
  const v = b.valeurs.find((x) => x.champ_id === c.id);
  if (!v) return null;
  if (v.valeur_texte !== null) return v.valeur_texte;
  if (v.valeur_num === null) return null;
  return `${nombre.format(v.valeur_num)}${c.unite ? ` ${c.unite}` : c.type === "echelle" ? "/10" : ""}`;
}

export function texteBilanPourClaude(o: {
  bilan: Bilan;
  precedent: Bilan | null;
  champs: ChampMesure[];
  jours: number;
  dateDebut: string | null;
  identite: string[];
  avecPhotos: boolean;
}): string {
  const { bilan, precedent, champs, jours } = o;
  const masquer = (t: string) => masquerIdentite(t, o.identite);
  const semaine = o.dateDebut ? Math.max(1, Math.floor(joursEntre(o.dateDebut, bilan.date_mesure) / 7) + 1) : null;

  const lignes: string[] = [
    "Je suis Cindy, coach en nutrition et sport. Voici le bilan d’une de mes clientes.",
    "Aide-moi à rédiger ma réponse : chaleureuse et encourageante, en la tutoyant, qui valorise ses progrès,",
    "répond à ses difficultés avec 1 à 3 conseils concrets, sans jugement sur le poids ni sur l’alimentation,",
    "sans conseil médical, et pas plus de 10 lignes. Commence par « Coucou [prénom] ».",
    "",
    `BILAN${semaine ? ` · semaine ${semaine} de l’accompagnement` : ""} · bilan tous les ${jours} jours${o.avecPhotos ? " · photos envoyées" : ""}`,
  ];

  for (const { section, champs: liste } of parSection(champs)) {
    const contenu: string[] = [];
    for (const c of liste) {
      const v = valeur(c, bilan);
      const precision = bilan.valeurs.find((x) => x.champ_id === c.id)?.precision;
      if (v === null && !precision) continue;
      let ligne = `- ${libelleChamp(c, jours)} : ${v === null ? "—" : masquer(v)}`;
      if (precedent && (c.type === "nombre" || c.type === "echelle")) {
        const a = precedent.valeurs.find((x) => x.champ_id === c.id)?.valeur_num;
        const b = bilan.valeurs.find((x) => x.champ_id === c.id)?.valeur_num;
        if (a != null && b != null) {
          const d = Math.round((b - a) * 100) / 100;
          ligne += d === 0 ? " (stable)" : ` (${ecartFmt.format(d)}${c.unite ? ` ${c.unite}` : ""} depuis le bilan précédent)`;
        }
      }
      if (precision) ligne += ` — précision : « ${masquer(precision)} »`;
      contenu.push(ligne);
    }
    if (contenu.length) lignes.push("", section.toUpperCase(), ...contenu);
  }
  if (bilan.commentaire) lignes.push("", "SON MESSAGE", masquer(bilan.commentaire));
  return lignes.join("\n");
}
