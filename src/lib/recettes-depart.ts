/** Résumé des recettes de départ par rapport à la bibliothèque de la coach (logique pure). */

export type RecetteDepartResume = { titre: string; anciens_titres?: string[]; repas: string[]; tags: string[]; photo?: string | null };
export type RecetteExistante = { titre: string; photo_path: string | null };

export type ResumeDepart = {
  total: number;
  /** Comptées selon leur repas principal (le premier). */
  parRepas: { petit_dejeuner: number; dejeuner: number; diner: number; collation: number };
  vegetariennes: number;
  /** Recettes de départ absentes de la bibliothèque (ni sous leur titre, ni sous un ancien titre). */
  manquantes: number;
  /** Recettes présentes dont la photo fournie a changé (ou manque) et qu'une mise à jour installerait. */
  photosAMettreAJour: number;
};

const PREFIXE = "depart/";

export function resumerDepart(depart: RecetteDepartResume[], existantes: RecetteExistante[]): ResumeDepart {
  const parTitre = new Map(existantes.map((r) => [r.titre, r]));
  const parRepas = { petit_dejeuner: 0, dejeuner: 0, diner: 0, collation: 0 };
  let vegetariennes = 0;
  let manquantes = 0;
  let photosAMettreAJour = 0;
  for (const r of depart) {
    const principal = r.repas[0] as keyof typeof parRepas;
    if (principal in parRepas) parRepas[principal]++;
    if (r.tags.includes("Végétarien")) vegetariennes++;
    const existante = [r.titre, ...(r.anciens_titres ?? [])].map((t) => parTitre.get(t)).find(Boolean);
    if (!existante) {
      manquantes++;
      continue;
    }
    // Une photo ajoutée par la coach n'est jamais remplacée : on ne la compte pas.
    const photoCoach = existante.photo_path && !existante.photo_path.startsWith(PREFIXE);
    if (r.photo && !photoCoach && existante.photo_path !== `${PREFIXE}${r.photo}`) photosAMettreAJour++;
  }
  return { total: depart.length, parRepas, vegetariennes, manquantes, photosAMettreAJour };
}

const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${n} ${n > 1 ? motPluriel : mot}`;

/** « 20 petits-déjeuners, 30 déjeuners, 30 dîners et 20 collations, dont 47 végétariennes » */
export function detailDepart(r: ResumeDepart): string {
  const p = r.parRepas;
  return (
    `${pluriel(p.petit_dejeuner, "petit-déjeuner", "petits-déjeuners")}, ${pluriel(p.dejeuner, "déjeuner")}, ` +
    `${pluriel(p.diner, "dîner")} et ${pluriel(p.collation, "collation")}, dont ${pluriel(r.vegetariennes, "végétarienne")}`
  );
}
