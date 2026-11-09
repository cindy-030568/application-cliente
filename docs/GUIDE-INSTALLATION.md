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
3. Déplie **Environment Variables**. Pour chaque ligne du tableau : écris le nom dans **Key**, la valeur dans **Value**, puis clique **+ Add More** pour passer à la suivante. Laisse **Environments** sur « Production and Preview ».

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | la Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | la Publishable key |
   | `SUPABASE_SECRET_KEY` | la Secret key → type **Secret** (ou interrupteur 🔒 *Sensitive*) |

   Les deux variables qui commencent par `NEXT_PUBLIC_` doivent être en type **Config** (pas Secret). L'adresse de l'app est détectée automatiquement : pas besoin d'autre variable.

   Vérifie qu'aucune valeur ne commence ou ne finit par un espace.

4. Clique **Create Project** et patiente 1 à 2 minutes. Vercel t'affiche l'adresse de ton app, du type `https://application-cliente-xxxx.vercel.app`.
5. Région des serveurs : **Settings → Functions → Function Region** → **Paris, France (cdg1)** → Save.

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
5. Ouvre une **fenêtre de navigation privée** (Chrome : `Ctrl+Maj+N` · Safari : `Cmd+Maj+N`) ou ton téléphone, colle le lien → **Me connecter**.
   ⚠️ Pas dans ton navigateur habituel : une seule connexion par navigateur, le lien remplacerait ta connexion coach.
   → Tu vois l'écran de consentement, puis l'**accueil cliente** avec son prénom et les 5 onglets.
6. Vérifie la sécurité : dans cette fenêtre cliente, tape l'adresse `…/coach` → tu es renvoyée sur l'accueil cliente.
7. Dans ta fenêtre coach (navigateur habituel) : décoche **Accès à la formation** → **Enregistrer** (message vert « Modifications enregistrées »). Dans la fenêtre privée de la cliente, recharge la page : la carte Formation est verrouillée.
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

---

# Phase 2 — Plans et ressources

## Mettre à jour la base de données (5 minutes, une seule fois)

1. Supabase → **SQL Editor** → **New query**.
2. Ouvre le fichier [`supabase/migrations/0002_plans_ressources.sql`](../supabase/migrations/0002_plans_ressources.sql) sur GitHub → icône **Copy raw file** → colle dans l'éditeur → **Run**.
   Tu dois voir « Success. No rows returned ».
3. Vérifie : menu **Storage** → un espace **plans** existe, marqué *Private*. C'est là que seront rangés les PDF, invisibles sans autorisation.

L'app se met à jour toute seule sur Vercel (onglet **Deployments** → **Ready**).

## Tester la phase 2

**Côté coach (ton navigateur habituel)**

1. Ouvre la fiche de ta cliente test → section **Plans**.
2. **Plan alimentaire** → **Ajouter** → « PDF dans l'app » → choisis ton PDF → **Publier**.
3. **Programme sportif** → **Ajouter** → « Lien Google Drive » → colle un lien Drive → **Publier**.
4. Refais une **Nouvelle version** du plan alimentaire (un autre PDF, ou le lien Nutrium) : l'ancienne passe dans « Versions précédentes ».
5. Clique **Voir** sur un plan : il s'ouvre dans un nouvel onglet.
6. Menu **Ressources** → **Nouvelle ressource** → titre, lien Drive, catégorie → « Toutes les clientes » → **Ajouter**. Puis une deuxième en « Certaines clientes » en cochant ta cliente test.

**Côté cliente (fenêtre privée ou téléphone)**

7. Accueil : le badge **Nouveau** apparaît sur « Mon plan alimentaire ».
8. Onglet **Nutrition** : le PDF s'affiche page par page. Teste **Télécharger le PDF** et **Ouvrir en plein écran pour zoomer**.
   Reviens à l'accueil : le badge « Nouveau » a disparu. Côté coach, la fiche affiche « Vu le … ».
9. En bas de **Nutrition** : « Mes versions précédentes » → ouvre l'ancienne version.
10. Onglet **Sport** : le bouton « Ouvrir mon plan » mène au lien Drive.
11. Accueil → **Ressources** : les ressources apparaissent rangées par catégorie.
12. Côté coach, décoche ta cliente test d'une ressource « Certaines clientes » → côté cliente, recharge : elle disparaît.

> **Liens Drive** : pour qu'une cliente puisse ouvrir un fichier ou un dossier Drive, il doit être partagé en
> « Tous les utilisateurs disposant du lien ». Pour un plan personnel, préfère le **PDF dans l'app** :
> il est privé et ne s'ouvre qu'avec un lien temporaire de 5 minutes.
