import type { ChampMesure } from "@/lib/types";

/** Remplace {jours} par le rythme de bilan de la cliente. */
export function avecJours(texte: string, jours: number | null | undefined): string {
  return texte.replace(/\{jours\}/g, String(jours && jours > 0 ? jours : 15));
}

export function libelleChamp(c: Pick<ChampMesure, "libelle">, jours?: number | null): string {
  return avecJours(c.libelle, jours);
}

/** Regroupe les champs par rubrique, dans l'ordre de leur première question. */
export function parSection<T extends Pick<ChampMesure, "section" | "ordre">>(champs: T[]): { section: string; champs: T[] }[] {
  const ordonnes = [...champs].sort((a, b) => a.ordre - b.ordre);
  const sections: { section: string; champs: T[] }[] = [];
  for (const c of ordonnes) {
    const existante = sections.find((s) => s.section === c.section);
    if (existante) existante.champs.push(c);
    else sections.push({ section: c.section, champs: [c] });
  }
  return sections;
}
