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
| `npm test` | tests unitaires (Vitest) |
| `npm run test:rls` | migrations + tests de sécurité RLS sur un Postgres local jetable |

Migrations SQL : `supabase/migrations/` (à exécuter dans l'ordre dans l'éditeur SQL de Supabase).
