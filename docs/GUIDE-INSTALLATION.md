# Guide d'installation pas à pas

> Pour Cindy. Aucune connaissance technique nécessaire : suis les étapes dans l'ordre.
> Compte environ **45 minutes** la première fois.

---

## Étape 1 — Créer le projet Supabase (la base de données)

1. Va sur **supabase.com** → **Start your project** → connecte-toi avec **GitHub** (le même compte que ce dépôt).
2. Clique **New project** :
   - **Name** : `fitw-cindy`
   - **Database Password** : clique **Generate a password**, puis **enregistre-le dans ton gestionnaire de mots de passe** (tu n'en auras presque jamais besoin, mais il ne faut pas le perdre).
   - **Region** : **West EU (Paris)** ← important pour le RGPD.
   - Plan : **Free** pour l'instant.
3. Clique **Create new project** et patiente 2 minutes.

## Étape 2 — Installer la base de données

1. Dans Supabase, menu de gauche → **SQL Editor** → **New query**.
2. Ouvre le fichier [`supabase/migrations/0001_socle.sql`](../supabase/migrations/0001_socle.sql) sur GitHub, clique sur l'icône **Copy raw file** (deux carrés), et colle tout dans l'éditeur Supabase.
3. Clique **Run** (en bas à droite). Tu dois voir « Success. No rows returned ».

## Étape 3 — Régler la connexion

Dans Supabase, menu **Authentication** :

1. **Sign In / Providers** (ou *Providers*) :
   - **Allow new users to sign up** : **désactivé** (seule toi crées les comptes).
   - **Email** : activé, **Confirm email** activé.
   - **Email OTP Expiration** : `3600` (1 heure). **Email OTP Length** : `6`.
   - Enregistre.
2. **Emails** (ou *Email Templates*) → onglet **Magic Link** :
   - **Subject** : `Ton code de connexion fitw_cindy`
   - **Body** : remplace tout par le contenu de [`supabase/email-templates/connexion.html`](../supabase/email-templates/connexion.html).
   - Enregistre.

## Étape 4 — Créer ton compte coach

1. **Authentication** → **Users** → **Add user** → **Create new user**.
2. Mets **ton email**, un mot de passe au hasard (il ne servira pas), coche **Auto Confirm User**, puis **Create user**.
3. Retourne dans **SQL Editor** → **New query**, colle cette ligne en mettant ton email, puis **Run** :
   ```sql
   select public.definir_coach('ton-email@exemple.fr');
   ```
   Le résultat doit afficher « OK : … est maintenant la coach. »

## Étape 5 — Récupérer les clés

Dans Supabase → **Project Settings** (roue crantée) :
- **Data API** : copie la **Project URL** (`https://xxxx.supabase.co`).
- **API Keys** : copie la **Publishable key** (`sb_publishable_…`) et la **Secret key** (`sb_secret_…`, bouton *Reveal*).
  - Si tu ne vois que des clés « anon » et « service_role » (onglet *Legacy*), elles fonctionnent aussi : anon = publishable, service_role = secret.

⚠️ La **Secret key** ne doit jamais être envoyée par message, mail ou dans le chat : tu la colles uniquement dans Vercel (étape suivante).

## Étape 6 — Mettre l'app en ligne avec Vercel

1. Va sur **vercel.com** → **Sign Up** → **Continue with GitHub** → plan **Hobby** (gratuit, suffisant pour les tests).
2. **Add New… → Project** → choisis le dépôt **application-cliente** → **Import**.
3. Ouvre **Environment Variables** et ajoute ces 4 lignes :

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | la Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | la Publishable key |
   | `SUPABASE_SECRET_KEY` | la Secret key |
   | `NEXT_PUBLIC_SITE_URL` | laisse `https://example.com` pour l'instant |

4. Clique **Deploy** et patiente 2 minutes. Vercel t'affiche l'adresse de ton app, du type `https://application-cliente-xxxx.vercel.app`.
5. Corrige l'adresse : **Settings → Environment Variables** → modifie `NEXT_PUBLIC_SITE_URL` avec cette adresse (sans `/` à la fin), puis **Deployments** → les 3 petits points du dernier déploiement → **Redeploy**.
6. Région des serveurs : **Settings → Functions → Function Region** → **Paris, France (cdg1)** → Save.

## Étape 7 — Relier Supabase à l'adresse de l'app

Supabase → **Authentication → URL Configuration** :
- **Site URL** : l'adresse Vercel (`https://application-cliente-xxxx.vercel.app`).
- **Redirect URLs** → **Add URL** : la même adresse suivie de `/**`.
- Enregistre.

---

## Tester la phase 1

1. Ouvre l'adresse Vercel sur ton ordinateur → mets ton email → tu reçois un email avec un code → tape-le.
   → Tu arrives sur ton **tableau de bord coach**.
2. **Réglages** : colle le lien de ta formation Notion, ton lien WhatsApp (`https://wa.me/33…`) et le lien de ta politique de confidentialité → Enregistrer.
3. **Clientes → Nouvelle cliente** : crée une cliente test avec **une autre de tes adresses email** (décoche « envoyer l'email », voir l'encadré ci-dessous).
4. Dans sa fiche, clique **Créer un lien à partager** → **Copier le lien**.
5. Ouvre une **fenêtre de navigation privée** (ou ton téléphone), colle le lien → **Me connecter**.
   → Tu vois l'écran de consentement, puis l'**accueil cliente** avec son prénom et les 5 onglets.
6. Vérifie la sécurité : dans cette fenêtre cliente, tape l'adresse `…/coach` → tu es renvoyée sur l'accueil cliente.
7. Retourne côté coach : décoche/coche **Accès à la formation** et regarde la carte changer côté cliente (recharge la page).
8. Passe la cliente test en **Accès fermé** → dans la fenêtre cliente, recharge : l'accès est coupé.
9. Teste **Supprimer définitivement** sur la cliente test.

> **À savoir sur les emails pendant les tests**
> Le service d'email intégré de Supabase est volontairement limité : il n'envoie **qu'aux adresses des membres de ton équipe Supabase** (donc à toi), et seulement **quelques emails par heure**.
> Pour connecter une cliente test, utilise donc **« Créer un lien à partager »** (aussi pratique pour l'envoyer par WhatsApp).
> Avant d'inviter tes vraies clientes, on branchera **Brevo** sur ton futur nom de domaine : les emails partiront alors à ton nom, sans limite gênante.

## Installer l'app sur ton téléphone (aperçu)

- **iPhone (Safari)** : bouton Partager → **Sur l'écran d'accueil**.
- **Android (Chrome)** : menu ⋮ → **Ajouter à l'écran d'accueil**.

(L'icône et l'installation complète arrivent en phase 8.)
