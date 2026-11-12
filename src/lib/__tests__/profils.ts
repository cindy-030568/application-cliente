import type { Cible } from "../moteur";

/** Trois profils types de clientes (cibles par repas), pour les tests et le rapport. */
export const PROFILS: { nom: string; description: string; repas: { libelle: string; type: string; cible: Cible }[] }[] = [
  {
    nom: "Profil A",
    description: "≈ 1 600 kcal, 4 repas",
    repas: [
      { libelle: "Petit-déjeuner", type: "petit_dejeuner", cible: { proteines: 25, glucides: 40, lipides: 12 } },
      { libelle: "Déjeuner", type: "dejeuner", cible: { proteines: 35, glucides: 50, lipides: 14 } },
      { libelle: "Collation", type: "collation", cible: { proteines: 15, glucides: 20, lipides: 6 } },
      { libelle: "Dîner", type: "diner", cible: { proteines: 35, glucides: 45, lipides: 14 } },
    ],
  },
  {
    nom: "Profil B",
    description: "≈ 1 900 kcal, 4 repas",
    repas: [
      { libelle: "Petit-déjeuner", type: "petit_dejeuner", cible: { proteines: 30, glucides: 50, lipides: 15 } },
      { libelle: "Déjeuner", type: "dejeuner", cible: { proteines: 40, glucides: 60, lipides: 18 } },
      { libelle: "Goûter", type: "collation", cible: { proteines: 20, glucides: 30, lipides: 8 } },
      { libelle: "Dîner", type: "diner", cible: { proteines: 40, glucides: 55, lipides: 16 } },
    ],
  },
  {
    nom: "Profil C",
    description: "≈ 1 450 kcal, 4 repas",
    repas: [
      { libelle: "Petit-déjeuner", type: "petit_dejeuner", cible: { proteines: 22, glucides: 35, lipides: 10 } },
      { libelle: "Déjeuner", type: "dejeuner", cible: { proteines: 30, glucides: 45, lipides: 12 } },
      { libelle: "Collation", type: "collation", cible: { proteines: 12, glucides: 18, lipides: 5 } },
      { libelle: "Dîner", type: "diner", cible: { proteines: 30, glucides: 40, lipides: 12 } },
    ],
  },
];

export const TOLERANCE = { pct: 10, g: 3 };
export const SANS_EXCLUSION = { categories: new Set<string>(), aliments: new Set<string>() };
