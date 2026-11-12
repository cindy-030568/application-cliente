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

---

# Phase 3 — Suivi et bilans

## Mettre à jour la base de données (une seule fois)

> Si tu n'as pas encore fait l'étape de la phase 2, fais-la d'abord : les migrations s'exécutent **dans l'ordre** (0002 puis 0003).

1. Supabase → **SQL Editor** → **New query**.
2. Copie le contenu de [`supabase/migrations/0003_bilans.sql`](../supabase/migrations/0003_bilans.sql) (icône **Copy raw file** sur GitHub) → colle → **Run**.
3. Vérifie : **Storage** contient maintenant un espace **photos**, marqué *Private*.

## Comment fonctionnent les bilans

- Le bilan d'une cliente est prévu tous les **N jours** à partir de sa **date de début** (réglable dans sa fiche, 14 par défaut).
- Il **s'ouvre 3 jours avant** la date prévue (réglable dans **Réglages → Le bilan**). La cliente voit « Ton bilan est ouvert » sur son accueil et dans **Suivi**.
- En retard, il reste envoyable pendant la moitié de l'intervalle (7 jours pour un rythme de 14 jours).
- Entre deux bilans, elle peut **noter une mesure** quand elle veut (« saisie libre ») : elle apparaît dans ses graphiques, mais pas dans ta file à traiter.
- Les relances automatiques par email et notification arrivent en phase 8. En attendant, le rappel est affiché dans l'app.

## Tester la phase 3

**Préparer** (ton navigateur habituel)

1. Fiche de ta cliente test → **Début du coaching** : mets une date **il y a 12 jours** et **Bilan tous les 14 jours** → Enregistrer.
   Son bilan est donc prévu dans 2 jours : il est déjà ouvert.
2. Fiche → **Ouvrir son suivi** → renseigne un **prochain rendez-vous** et un lien de visio → Enregistrer.

**Côté cliente** (fenêtre privée ou téléphone)

3. Accueil : les cartes « Ton bilan est ouvert » et « Prochain rendez-vous » apparaissent.
4. **Faire mon bilan** : quelques mesures, les ressentis, une ou deux photos, un commentaire → **Envoyer mon bilan à Cindy**.
5. Onglet **Suivi** : « Bilan envoyé ✓ », puis graphiques, photos et historique.
6. **Noter une mesure** (par ex. seulement le tour de taille) : elle s'ajoute aux graphiques.

**Côté coach**

7. Le menu **Bilans** affiche une pastille **1** → ouvre le bilan : mesures, ressentis (avec l'écart par rapport au bilan précédent), photos, commentaire.
8. Écris ton retour → **Envoyer et marquer comme traité**.
9. **Tableau de bord** : bilans à traiter et section « À surveiller » (bilans manquants, clientes qui ne se connectent plus, fins de suivi dans moins de 15 jours).
10. Suivi de la cliente → **Exporter (Excel / CSV)** : ouvre le fichier dans Excel.
11. **Saisir un bilan** pour elle (comme pendant une visio).
12. **Réglages → Le bilan** : renomme un champ, masque-en un, ajoute « Tour de mollet ».

**De nouveau côté cliente**

13. Accueil : « Cindy a répondu à ton bilan » → le message s'affiche ; la carte disparaît une fois lue.
14. Côté coach, coche **Mode sans chiffres** dans son suivi → côté cliente, le bilan ne propose plus que les ressentis, sans poids, mesures ni photos.

---

# Phase 4 — Vidéos d'exercices

## Mettre à jour la base de données (une seule fois)

1. Ouvre [`supabase/migrations/0004_videos.sql`](../supabase/migrations/0004_videos.sql) sur GitHub → icône **Copy raw file** (deux carrés).
2. Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

## Préparer une vidéo sur YouTube

1. Mets en ligne ta vidéo sur ta chaîne YouTube.
2. Visibilité : **Non répertoriée**. Une vidéo « Privée » ne peut pas être lue dans l'app.
3. Sous la vidéo : **Partager** → **Copier** le lien (du type `https://youtu.be/…`).

## Tester la phase 4

**Côté coach**

1. Menu **Vidéos** → **Nouvelle vidéo**.
2. Nom de l'exercice, lien YouTube (l'aperçu apparaît à droite), points clés et erreurs fréquentes (**une par ligne**), filtres (plusieurs cases possibles par colonne).
3. **Ajouter la vidéo**. Ajoute-en une deuxième, en décochant **Visible par les clientes** (brouillon).
4. Dans la colonne **Filtres**, ajoute un matériel (par ex. « TRX »).

**Côté cliente** (fenêtre privée ou téléphone)

5. Onglet **Sport** → **La bibliothèque** : seule la vidéo publiée apparaît, pas le brouillon.
6. Touche un filtre (par ex. « Fessiers »), puis tape un mot dans la recherche.
7. Ouvre l'exercice → appuie sur **Lecture** : la vidéo démarre dans l'app.

> Confidentialité : le lecteur YouTube n'est chargé qu'au moment où la cliente appuie sur Lecture, depuis le domaine youtube-nocookie.com (aucun cookie YouTube déposé avant la lecture).

---

# Le bilan sur la trame de Cindy

Le bilan reprend la « Trame bilan » (Drive) : **Ressentis & énergie**, **Nutrition & habitudes**, **Victoires & difficultés**, **Projection & engagement**, puis les mesures et les photos.

## Mettre à jour la base de données (une seule fois)

> Fais d'abord `0004_videos.sql` si ce n'est pas encore fait (même si tu ajoutes les vidéos plus tard).

1. Ouvre [`supabase/migrations/0005_trame_bilan.sql`](../supabase/migrations/0005_trame_bilan.sql) → **Copy raw file**.
2. Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

Les anciennes questions de ressenti (faim, confort digestif, cycle) sont masquées. Leurs réponses déjà envoyées restent dans l'historique, et tu peux les réafficher dans **Réglages → Le bilan**.

## Tester

1. Côté cliente : **Suivi** → **Faire mon bilan** → les 4 rubriques de ta trame, puis les mesures et photos.
   Sous certaines questions, « + Préciser si tu veux » ouvre une petite zone de texte.
2. Côté coach : ouvre le bilan dans **Bilans** → les réponses sont rangées par rubrique, dans l'ordre de ta trame.
3. **Réglages → Le bilan** :
   - modifie le texte d'introduction ;
   - renomme une rubrique (clique sur son titre) ;
   - modifie une question ou son aide ;
   - ajoute une question « Réponse libre ».
   Dans un texte, `{jours}` s'affiche avec le rythme de bilan de chaque cliente.
4. Entre deux bilans, « Noter une mesure » ne propose que les mesures, pas tout le questionnaire.

---

# Connexion par mot de passe

- L'écran de connexion propose **email + mot de passe**. En dessous, « Première connexion ou mot de passe oublié ? » envoie un **code par email**, comme avant.
- Après une connexion par code (ou par lien), l'app propose de **créer un mot de passe**. C'est facultatif : « Plus tard » est toujours possible.
- **Changer son mot de passe** : côté cliente, Profil → « Mon mot de passe » ; côté coach, « Mon mot de passe » en bas du menu.
- **Rester connectée** (cochée par défaut) : la connexion reste ouverte sur l'appareil. Décochée, elle se ferme quand le navigateur est fermé.

> Rien à régler dans Supabase : la connexion par mot de passe est déjà active.
> Pour tester côté cliente, la fenêtre de navigation privée oublie toujours la connexion à sa fermeture : c'est normal.

---

# Phase 5 — Aliments et recettes

## Mettre à jour la base de données (une seule fois)

1. Ouvre [`supabase/migrations/0006_aliments_recettes.sql`](../supabase/migrations/0006_aliments_recettes.sql) → **Copy raw file**.
2. Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».
3. Vérifie : **Storage** contient un espace **recettes** (marqué *Public* : ce sont les photos des plats, sans donnée personnelle).

## Dans ton dashboard, dans cet ordre

1. **Aliments** → **Importer la table Ciqual (3 049 aliments)**. Patiente environ 30 secondes.
   La table officielle de l'ANSES est importée avec ses catégories d'exclusion proposées automatiquement. Ce sont des propositions : vérifie celles des aliments que tu utilises, surtout pour les allergies.
2. **Recettes** → **Importer les 50 recettes de départ**.
3. Ouvre une recette pour la découvrir ou la modifier :
   - le **rôle** de chaque ingrédient indique ce que le moteur pourra ajuster :
     - **Protéine / Glucide / Lipide** : ajusté pour atteindre la cible correspondante ;
     - **Fruit** : ajusté dans sa fourchette ;
     - **Fixe** : légumes, épices, sauces légères, ne bouge pas ;
   - **Min / Max / Pas** encadrent les quantités que le moteur pourra proposer (le pas sert à l'arrondi : 5 g, 1 œuf…) ;
   - en haut du tableau, les macros de la recette de base.
4. Ajoute une photo à une recette, puis crée une recette de test avec « + Ajouter un ingrédient ».
5. **Fiche de ta cliente test** :
   - **Repas et cibles** : ajoute ses repas (petit-déjeuner, déjeuner, collation(s), dîner…) avec protéines, glucides et lipides. Les kcal se calculent seules. → **Enregistrer les repas**.
   - **Aliments exclus** : essaie le raccourci « Végétarienne », ajoute un aliment précis → **Enregistrer les exclusions**.
6. **Aliments** → **Nouvel aliment** : crée un aliment perso (valeurs de l'étiquette pour 100 g), avec une unité si besoin.

> Les recettes ne sont pas encore visibles côté cliente : c'est l'objet de la phase 7. La phase 6 te permet déjà de voir, dans la fiche, ce qu'elle verra.

---

# Phase 6 — Le moteur de recettes adaptées

Rien à changer dans Supabase pour cette phase.

## Ce que fait le moteur

Pour chaque repas d'une cliente, il recalcule les quantités de chaque recette pour atteindre ses cibles de protéines, glucides et lipides :

- seuls les ingrédients **Protéine / Glucide / Lipide / Fruit** bougent, toujours entre leur **min** et leur **max**, arrondis au **pas** (5 g, 1 œuf…) ;
- les ingrédients **Fixes** ne bougent jamais ;
- une recette est **proposée** si chaque macro tombe dans l'écart accepté (réglable) ;
- une recette qui contient un **aliment exclu** n'est jamais proposée.

Le fichier [`docs/MOTEUR-CAS.md`](MOTEUR-CAS.md) montre des exemples concrets sur trois profils types.

## Mettre à jour tes recettes de départ (une seule fois)

Plusieurs recettes de départ ont été retravaillées pour que le moteur puisse les adapter à plus de cibles (6 ont changé de nom, par exemple « Tartine avocat & œufs brouillés »).

1. **Aliments** → **Importer la table Ciqual** (une correction de catégorie : le seitan est maintenant classé « Gluten »).
2. **Recettes** → **Mettre à jour les recettes de départ** → confirme.
   - Les 50 recettes de départ reprennent leur dernière version : titre, ingrédients, étapes.
   - Tes **photos**, tes **brouillons** et **tes propres recettes** ne changent pas.
   - Si tu avais modifié une recette de départ, ta modification est remplacée.

## Tester la phase 6

1. **Réglages** → carte **Recettes adaptées** :
   - **Écart accepté** : 10 % par macro, ou au moins 3 g (pour les petites cibles) ;
   - **Si une recette ne peut pas atteindre les cibles** : « Ne pas la proposer » (recommandé) ou « La proposer avec la mention approximative ».
2. **Clientes** → ta cliente test (avec ses repas et cibles remplis) → carte **Ses recettes** → **Aperçu des recettes**.
3. Un onglet par repas : les recettes proposées, avec les quantités calculées pour elle. Le chiffre à côté du repas est le nombre de recettes proposées.
4. Essaie :
   - change une cible dans sa fiche, puis reviens : les quantités changent ;
   - ajoute l'exclusion « Végétarienne » : les recettes avec viande ou poisson disparaissent (« X écartées ») ;
   - passe le réglage sur « La proposer avec la mention approximative » : des recettes marquées **Approximative** apparaissent en fin de liste.
