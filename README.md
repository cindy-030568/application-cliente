# fitw_cindy — app clientes

Application web mobile (PWA) de coaching nutrition et sport de Cindy (@fitw_cindy).

- **Plan d'architecture** : [docs/PLAN.md](docs/PLAN.md)
- **Guide d'installation et de test (pour Cindy)** : [docs/GUIDE-INSTALLATION.md](docs/GUIDE-INSTALLATION.md)

## Technique

- Next.js 16 (App Router) · TypeScript · Tailwind CSS 4
- Supabase (Postgres + RLS, Auth par email OTP / lien, région Paris)
- Charte : variables CSS dans `src/app/globals.css`

```bash
npm install
cp .env.example .env.local   # puis renseigner les clés Supabase
npm run dev
```

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | build de production |
| `npm run lint` | ESLint |
| `npm run typecheck` | vérification TypeScript |
| `npm test` | tests unitaires (Vitest) |
| `npm run test:rls` | migrations + tests de sécurité RLS sur un Postgres local jetable |
| `npm run test:e2e` | parcours principaux dans un navigateur (Playwright) : connexion cliente, envoi d'un bilan, recette adaptée, bilan côté coach |

### Tests de parcours (Playwright)

`npm run test:e2e` construit l'app puis la lance contre un **Supabase simulé en mémoire** (`e2e/supabase-simule.mjs`, données fictives, code de connexion `123456`). Les clés utilisées sont factices et définies dans `playwright.config.ts` : les tests ne contactent jamais la vraie base et n'envoient ni email ni notification. Chromium doit être installé (`npx playwright install chromium` si besoin). La sécurité des données (RLS) est vérifiée à part par `npm run test:rls`.

Migrations SQL : `supabase/migrations/` (à exécuter dans l'ordre dans l'éditeur SQL de Supabase). Toute nouvelle table doit être ajoutée à la sauvegarde (`src/lib/sauvegarde.ts`) : un test le vérifie.

Tâches planifiées : `supabase/horloge-rappels.sql` (horloges Supabase : journal toutes les 15 min, tâche du matin à 7 h à Paris). `vercel.json` et `netlify/functions` gardent une tâche du matin de secours ; elle ne s'exécute qu'une fois par jour (table `taches_du_matin`).
