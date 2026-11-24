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

- Le bilan d'une cliente est prévu tous les **N jours** à partir de sa **date de début** (réglable dans sa fiche, 14 par défaut). Comme dans un tableau, le jour du démarrage compte comme le jour 1 : démarrage le lundi 7 sept. avec un bilan tous les 14 jours → dimanche 20 sept., puis 4 oct., 18 oct.…
- **Photos de suivi toutes les 4 semaines** : avec un bilan tous les 14 jours, un bilan sur deux est un « bilan + photos ». La cliente le voit sur son accueil, la partie photos est mise en avant dans le formulaire, et le rappel le mentionne. Dans ton tableau de bord, ces bilans portent l'étiquette « + photos ». Les bilans simples gardent un bouton « Ajouter des photos (facultatif) ».
- Il **s'ouvre 3 jours avant** la date prévue (réglable dans **Réglages → Le bilan**). La cliente voit « Ton bilan est ouvert » sur son accueil et dans **Suivi**.
- En retard, il reste envoyable pendant la moitié de l'intervalle (7 jours pour un rythme de 14 jours).
- Entre deux bilans, elle peut **noter une mesure** quand elle veut (« saisie libre ») : elle apparaît dans ses graphiques, mais pas dans ta file à traiter.
- Les rappels par email et notification sont en place depuis la phase 8 (voir plus bas).

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

> Les recettes sont visibles côté cliente depuis la phase 7.

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

---

# Phase 7 — Les recettes côté cliente et la liste de courses

## Mettre à jour la base de données (une seule fois)

1. Ouvre [`supabase/migrations/0007_liste_courses.sql`](../supabase/migrations/0007_liste_courses.sql) → **Copy raw file**.
2. Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

La liste de courses est **privée** : chaque cliente ne voit que la sienne, et toi non plus tu ne la vois pas.

## Les photos des recettes

4 recettes de départ ont maintenant leur photo, créée avec l'IA de Canva : bowl skyr myrtilles, pancakes à la banane, overnight oats, omelette épinards-feta.
Pour les afficher : **Recettes** → **Mettre à jour les recettes de départ** → confirme. Les photos que tu as ajoutées toi-même ne sont jamais remplacées.

Pour les autres recettes : ouvre la recette → **Ajouter une photo**.

## Tester la phase 7

Connecte-toi avec ta **cliente test** (sur ton téléphone, c'est encore mieux), après avoir rempli ses repas et cibles dans sa fiche.

1. Onglet **Recettes** :
   - « Quel repas veux-tu remplacer ? » : un bouton par repas, puis **Toutes** (pour s'inspirer) et **Favoris** ;
   - la recherche et les filtres (Rapide, Végétarien, Sucré…).
2. Ouvre une recette :
   - les quantités sont **les siennes**, calculées pour ce repas ;
   - si la recette convient à plusieurs repas, elle peut choisir lequel ;
   - **1 · 2 · 3 · 4** : le nombre de portions (batch cooking) multiplie les quantités ;
   - le **cœur** l'ajoute à ses favoris ;
   - en petit, les macros d'une portion (masquées si son suivi est en « mode sans chiffres »).
3. **Ajouter à ma liste de courses**, sur deux ou trois recettes.
4. **Ma liste de courses** (en haut de l'onglet Recettes) :
   - les ingrédients sont **additionnés** (deux recettes avec du poulet = une seule ligne) et rangés **par rayon** ;
   - toucher un article le coche ;
   - « Ajouter autre chose » pour le pain, le café… ;
   - **Envoyer ma liste** : sur téléphone, elle s'envoie par WhatsApp, SMS, Notes… ;
   - « Retirer » une recette, « Retirer les articles cochés », « Vider la liste ».

---

# Phase 8 — L'app sur le téléphone et les rappels de bilan

## 1. Mettre à jour la base de données (une seule fois)

1. Ouvre [`supabase/migrations/0008_rappels.sql`](../supabase/migrations/0008_rappels.sql) → **Copy raw file**.
2. Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

## 2. La clé Brevo (pour les emails)

1. Sur [brevo.com](https://app.brevo.com), clique sur ton nom en haut à droite → **SMTP & API** → onglet **API Keys** → **Generate a new API key**.
2. Nom : `application` → **Generate** → **copie** la clé (elle commence par `xkeysib-`). Ne la colle nulle part ailleurs que dans Vercel.
3. Vercel → ton projet → **Settings** → **Environment Variables** → **Add** :
   - Key : `BREVO_API_KEY`, Value : la clé, coche **Sensitive** → **Save**.

## 3. Les clés des rappels (notifications + envoi du matin)

1. Dans l'app : **Réglages** → carte **Rappels de bilan** → **Créer mes clés**.
2. Pour chacune des 3 lignes (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`) : **Copier** → Vercel → **Add** → colle le nom et la valeur.
   - Coche **Sensitive** pour `VAPID_PRIVATE_KEY` et `CRON_SECRET` (pas pour la clé publique).
3. Vercel → **Deployments** → sur le dernier : **⋯** → **Redeploy**. Patiente 2 minutes.
4. Recharge **Réglages** : les 3 pastilles « Emails », « Notifications », « Envoi automatique » sont vertes ✓.

> Les clés sont créées dans ton navigateur : elles ne passent par aucun serveur, ni par moi.

## 4. Tester

**Les emails**
- **Réglages** → **M'envoyer un email de test** → regarde ta boîte (et les spams).
- Si Brevo refuse la clé : dans Brevo, menu **Sécurité** → **IP autorisées** → désactive le blocage des adresses IP inconnues (Vercel change d'adresse à chaque envoi).

**Le téléphone de ta cliente test**
1. Ouvre l'app sur le téléphone et connecte-toi avec ta cliente test.
2. Sur l'accueil, la carte **Installe l'app sur ton téléphone** explique comment faire :
   - iPhone : Safari → **Partager** → **Sur l'écran d'accueil** → **Ajouter** ;
   - Android : bouton **Installer l'app**, ou Chrome → **⋮** → **Ajouter à l'écran d'accueil**.
3. Ouvre l'app **depuis la nouvelle icône** → **Profil** (en haut à droite) → **Mes rappels de bilan** :
   - **Activer les notifications** → autorise ;
   - **M'envoyer un test** : la notification arrive en quelques secondes.
4. Dans ta fiche cliente, la carte **Rappels de bilan** indique si elle a activé les notifications et les rappels envoyés.

## Comment partent les rappels

- **Chaque matin** (entre 8 h et 10 h), l'app regarde chaque cliente active :
  - son bilan vient de s'ouvrir → « Ton bilan est prêt » ;
  - toujours pas envoyé **2 jours après** → une seule relance.
- Jamais deux fois le même rappel, et rien si le bilan est déjà envoyé.
- Tu règles le délai et les deux messages dans **Réglages** ; tu peux aussi tout mettre en pause.
- **Envoyer les rappels du jour maintenant** fait la même chose tout de suite (pratique pour tester).
- Tant qu'il n'y a pas de nom de domaine (phase 9), les emails peuvent arriver dans les spams : c'est normal.

---

# Phase 9 — Mise en ligne

## Étape 1 : brancher ton nom de domaine sur Vercel

L'app sera à l'adresse **https://app.fitw-cindy.fr**.

**Dans Vercel**
1. Ton projet → onglet **Settings** → menu de gauche **Domains** → **Add Domain**.
2. Écris `app.fitw-cindy.fr` → **Add** (s'il demande, choisis « Production »).
3. Vercel affiche « Invalid Configuration » et un petit tableau **Type / Name / Value**. Laisse cette page ouverte : la ligne de type **CNAME** est celle qu'on va recopier chez OVH.

**Chez OVH**
1. Connecte-toi sur [ovhcloud.com](https://www.ovh.com/manager/) → **Web Cloud** → **Noms de domaine** → **fitw-cindy.fr** → onglet **Zone DNS**.
2. **Ajouter une entrée** → choisis **CNAME**.
3. **Sous-domaine** : `app`. **Cible** : la valeur « Value » donnée par Vercel (elle finit par `vercel-dns.com`), avec un **point à la fin**. Exemple : `xxxx.vercel-dns-017.com.`
4. **Suivant** → **Valider**.

Après 5 à 30 minutes, Vercel passe en « Valid Configuration » ✅ et le cadenas HTTPS est créé tout seul.

**Ensuite, dans Vercel** → **Settings** → **Environment Variables** → **Add** :
- Key `SITE_URL`, Value `https://app.fitw-cindy.fr`, type **Config** → **Save**.
- Puis **Deployments** → **⋯** → **Redeploy**.

**Dans Supabase** (pour que les liens de connexion pointent vers la nouvelle adresse)
1. **Authentication** → **URL Configuration**.
2. **Site URL** : `https://app.fitw-cindy.fr` → **Save**.
3. **Redirect URLs** → **Add URL** : `https://app.fitw-cindy.fr/**` → **Save**. (Garde l'ancienne adresse vercel.app pour l'instant.)

**Tester** : ouvre https://app.fitw-cindy.fr, connecte-toi, et sur ton téléphone réinstalle l'app depuis cette nouvelle adresse (supprime l'ancienne icône).

> Vercel gratuit interdit en principe l'usage commercial : on démarre ainsi, et on basculera sur Netlify (gratuit, usage commercial autorisé) plus tard. L'app est déjà prête pour ce changement.

## Sauvegarde mensuelle

**Réglages** → **Télécharger une sauvegarde** : un fichier avec toutes les données. Fais-le une fois par mois et range-le dans un endroit privé.

> Les fichiers (PDF des plans, photos de suivi, photos de la communauté) ne sont **pas** dans ce fichier : il contient seulement leur emplacement. Ils restent rangés dans Supabase (**Storage**).

## Étape 2 : relier Brevo à ton domaine (emails à ton nom, moins de spams)

**A. Authentifier le domaine** (une seule fois, puis jusqu'à 48 h d'attente)
1. Brevo → ton nom en haut à droite → **Expéditeurs, domaines et IP dédiées** → onglet **Domaines** → **Ajouter un domaine**.
2. Écris `fitw-cindy.fr` → valide.
3. Si Brevo propose de **se connecter à ton hébergeur (OVH) pour tout configurer automatiquement**, accepte : c'est le plus simple.
4. Sinon, Brevo affiche 3 ou 4 lignes (Brevo code, DKIM, DMARC). Pour chacune, chez OVH → **Zone DNS** → **Ajouter une entrée** :
   - choisis le **type** indiqué par Brevo (**TXT** ou **CNAME**) ;
   - **Sous-domaine** : ce que Brevo indique comme « Hôte / Nom », **sans** `.fitw-cindy.fr` à la fin (ex. `brevo1._domainkey`, `_dmarc`, ou vide pour le Brevo code) ;
   - **Valeur / Cible** : copie exactement ce que donne Brevo (pour un CNAME, ajoute un point à la fin).
5. Retourne dans Brevo → **Authentifier ce domaine**. S'il dit que ce n'est pas encore bon, réessaie quelques heures plus tard.

**B. Créer l'expéditeur** (quand le domaine est authentifié ✅)
1. Brevo → **Expéditeurs, domaines et IP dédiées** → onglet **Expéditeurs** → **Ajouter un expéditeur**.
2. Nom : `Cindy · fitw_cindy` — Email : `cindy@fitw-cindy.fr`.
3. L'app utilisera automatiquement cet expéditeur pour les rappels.

**C. Les emails de connexion (codes)** : Supabase → **Authentication** → **Emails** → **SMTP Settings** → remplace l'adresse d'expéditeur par `cindy@fitw-cindy.fr` → **Save**.

## Étape 3 : avant d'inviter tes vraies clientes

### Sécurité de tes comptes (10 minutes, une fois)
Active la **double authentification** (code sur ton téléphone en plus du mot de passe) sur les comptes qui donnent accès aux données :
- [ ] Supabase (Account → Security)
- [ ] Vercel (Account Settings → Authentication)
- [ ] GitHub (Settings → Password and authentication)
- [ ] Brevo et OVH (paramètres du compte → Sécurité)

### RGPD : ce que l'app fait déjà
- Consentement explicite de chaque cliente à la première connexion (données de santé).
- Données hébergées dans l'Union européenne (Supabase, Paris) ; serveurs de l'app à Paris (Vercel) ; emails par Brevo (France).
- Après 3 ans d'accès fermé, le tableau de bord t'indique les clientes dont il faut supprimer les données.
- Chaque cliente ne voit que ses propres données ; tes notes restent privées ; ses listes de courses ne sont visibles que par elle.
- Export de ses mesures (Excel / CSV) depuis son suivi, suppression définitive depuis sa fiche.

### RGPD : ce que tu dois vérifier de ton côté
- [ ] **Ta politique de confidentialité** (sur ton site) mentionne :
  - les données collectées : identité, email, mesures, photos, ressentis, habitudes alimentaires (données de santé) ;
  - pourquoi : le suivi de ton accompagnement ;
  - sur quelle base : le consentement de la cliente ;
  - combien de temps : 3 ans après la fin de l'accompagnement ;
  - qui les héberge : Supabase (base de données, Paris), Vercel (hébergement de l'app, serveurs à Paris, société américaine), Brevo (emails, France), YouTube (vidéos d'exercices, sans cookie avant clic) ;
  - ses droits : accès, rectification, suppression, portabilité, retrait du consentement, réclamation à la CNIL ;
  - comment te contacter.
- [ ] Le lien de cette politique est dans **Réglages → Lien de ta politique de confidentialité**.
- [ ] Supabase : télécharge et garde le **DPA** (accord de traitement des données), dans Supabase → Organization → **Legal Documents**.
- [ ] Un **registre des traitements** simple (un tableau d'une page) : le modèle de la CNIL suffit.
- [ ] Données de santé : comme tu n'es pas professionnelle de santé, l'hébergement « HDS » ne s'applique en principe pas. En cas de doute, une vérification rapide auprès de la CNIL ou d'un juriste est une bonne idée.

### Nettoyer les données de test
- [ ] **Clientes** → chaque cliente test → **Supprimer définitivement** (supprime aussi ses bilans, photos et plans).
- [ ] **Recettes** : supprime les recettes de test éventuelles.
- [ ] **Supabase → Authentication → URL Configuration** : tu peux retirer l'ancienne adresse `vercel.app` des Redirect URLs.
- [ ] Fais une première **sauvegarde** (Réglages → Télécharger une sauvegarde).

Ensuite, crée tes vraies clientes depuis **Clientes → Nouvelle cliente** : elles reçoivent leur email de bienvenue de la part de `cindy@fitw-cindy.fr`.

---

# Phase 10 — La communauté

Un seul groupe d'échange entre tes clientes : messages, photos, réactions (❤️ 👏 💪 😂). Quand elle est ouverte, tes clientes ont un onglet **Communauté** dans la barre du bas, avec le nombre de nouveaux messages. Chaque cliente choisit de rejoindre ou non, après avoir accepté ta charte. Les autres voient **seulement son prénom** et ce qu'elle publie : jamais son suivi (poids, mesures, bilans, plans).

## 1. Mettre à jour la base de données (une seule fois)

1. Ouvre [`supabase/migrations/0009_communaute.sql`](../supabase/migrations/0009_communaute.sql) → **Copy raw file**.
2. Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

Rien à ajouter dans Vercel : les notifications utilisent les clés de la phase 8.

## 2. Ouvrir la communauté

1. Dashboard → **Communauté** (dans le menu ; sur téléphone, touche d'abord le bouton **Menu** en haut).
2. Relis et adapte la **charte** (le texte que chaque cliente accepte avant d'entrer).
3. Coche **Communauté ouverte** → **Enregistrer**. La carte « La communauté » apparaît sur l'accueil de tes clientes.

Décocher « Communauté ouverte » la cache aux clientes sans rien effacer.

## 3. Tester avec ta cliente test

1. Accueil → carte **La communauté** → lis la charte → coche la case → **Rejoindre**.
2. Écris un message, ajoute une **photo** (elle est réduite et ses informations cachées, comme la position GPS, sont retirées) → **Publier**.
3. Mets une réaction, puis **Supprimer** ton message.
4. Dans **Mes réglages** (en bas) : « Me prévenir des nouveaux messages » (une notification au plus par heure, sans le contenu du message ; il faut aussi avoir activé les notifications dans le profil).
5. De ton côté, publie un message : il apparaît avec le badge **Coach**. Tu peux l'**épingler** pour qu'il reste en haut (pratique pour un message de bienvenue).

## La modération

- **Signaler** : une cliente peut signaler le message d'une autre. Un nombre apparaît à côté de « Communauté » dans ton menu. Pour chaque signalement : **Supprimer le message** ou **Garder le message**.
- **Supprimer** : tu peux supprimer n'importe quel message ; chaque cliente peut supprimer les siens.
- **Retirer** une cliente (liste des membres, en bas) : elle ne voit plus la communauté et ne peut pas revenir seule. **Réintégrer** la fait revenir ; **Lui permettre de revenir** efface son adhésion (elle pourra de nouveau rejoindre seule).
- Une cliente dont l'accompagnement est **terminé** perd l'accès automatiquement. Si tu la **supprimes définitivement**, ses messages et ses photos partent avec elle.

## RGPD

- [ ] Ajoute la partie « Communauté » à ta politique de confidentialité (je l'ai rédigée dans ton document).
- La communauté est facultative : la cliente donne son accord en acceptant la charte, et peut partir quand elle veut (« Quitter la communauté »).

---

# Formule, paiement et suivi sportif

## Mettre à jour la base de données (une seule fois)

Deux fichiers, **dans cet ordre** (ignore le 1er s'il est déjà fait) :

1. [`0010_formule_paiement_sport.sql`](../supabase/migrations/0010_formule_paiement_sport.sql) → **Copy raw file** → Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».
2. [`0011_paiement_cote_cliente.sql`](../supabase/migrations/0011_paiement_cote_cliente.sql) → même chose.

## Utilisation

- **Nouvelle cliente** ou **fiche d'une cliente** → **Formule et paiement** : formule (les formules déjà utilisées te sont proposées), montant total, moyen de paiement, payé en 1 à 12 fois, date du 1er paiement.
- En plusieurs fois, le **1er paiement vaut 50 %** du total (modifiable : « Montant du 1er paiement »), puis le reste est réparti en **mensualités égales**, une par mois à la même date. Coche **Marquer payée** quand tu reçois un paiement. Si tu modifies ensuite le montant ou le nombre de fois, les échéances déjà payées sont gardées et les autres recalculées.
- Ton **tableau de bord** affiche les échéances **en retard** et celles des **14 prochains jours**.
- **Côté cliente** : dans son **profil**, carte « Ma formule et mes paiements » (formule, montant, échéancier, réglé / à venir). Ta **note** reste privée. Sur son accueil, une carte apparaît 3 jours avant une mensualité.
- **Rappel** : le matin de chaque échéance non cochée, elle reçoit un email et une notification (« Lui envoyer un rappel le jour de chaque échéance », cochée par défaut, à décocher cliente par cliente).
- Ces informations sont dans ta sauvegarde mensuelle et supprimées avec la cliente.
- **Suivi sportif inclus** (fiche → Infos et accès) : décoché, ta cliente ne voit plus l'onglet Sport, son programme sportif ni les vidéos d'exercices.

---

# Tes notifications (coach)

## Mettre à jour la base de données (une seule fois)

[`0012_notifications_coach.sql`](../supabase/migrations/0012_notifications_coach.sql) → **Copy raw file** → Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

## Activer

1. **Réglages** → **Mes notifications** : choisis ce qui te prévient (bilan envoyé et message signalé sont activés ; nouveau message de la communauté, au plus 1 par heure, est désactivé), et si tu veux aussi un **email**.
2. Sur **chaque appareil** (ordinateur et téléphone), ouvre Réglages et touche **Activer les notifications ici**, puis **M'envoyer un test**.
   - **iPhone** : installe d'abord l'app sur l'écran d'accueil (Safari → Partager → « Sur l'écran d'accueil »), ouvre-la depuis l'icône, connecte-toi avec ton compte coach, puis va dans Réglages.
   - **Ordinateur** : Chrome, Edge ou Safari ; autorise les notifications quand le navigateur le demande.
3. Une cliente envoie son bilan → tu reçois « Nouveau bilan 📝 · Prénom vient d'envoyer son bilan » ; toucher la notification ouvre le bilan.

---

# Photos de départ (avant / après)

Pour une cliente qui a commencé avant l'app : fiche → **Suivi et bilans** → **Photos de départ**. La date proposée est son démarrage ; ajoute ses photos face / profil / dos (et ses mesures du début si tu les as) → **Enregistrer le point de départ**. Elles deviennent l'« avant » du comparatif, pour toi et pour elle. Ce point de départ ne compte pas comme un bilan prévu et n'arrive pas dans ta file à traiter.

---

# Journal quotidien (ton tableau de suivi dans l'app)

## Mettre à jour la base de données (une seule fois)

[`0013_journal_quotidien.sql`](../supabase/migrations/0013_journal_quotidien.sql) → **Copy raw file** → Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

## Côté cliente

- **Suivi** → **Mon journal** (et une carte « Mon journal du jour » sur l'accueil tant que la journée n'est pas remplie).
- Chaque jour : poids, tour de taille, sommeil (« 7h30 » ou « 7,5 »), hydratation, pas, trainings, stress (1 à 5), digestion (1 à 5), règles, observations. Tout est facultatif. Pour rattraper un oubli : les **jours oubliés** des 3 dernières semaines s'affichent en boutons (un toucher pour le remplir, puis « Remplir le jour oublié suivant »), et **Remplir un autre jour** ouvre un calendrier jusqu'au début du suivi.
- En mode sans chiffres, poids et tour de taille sont masqués.

## Ce qu'on voit (elle et toi)

- **Synthèse** : poids et tour de taille de départ (moyenne de la semaine 1) → actuels, moyennes de sommeil, eau, pas, stress, digestion, trainings par semaine et total.
- **Écart mois par mois** (semaine 4, 8, 12… comparée à la semaine 1).
- **Semaine par semaine** : numéro, dates, moyennes (trainings : total), jours de règles, détail jour par jour avec les observations, couleurs repères (vert / beige / rose).
- **Les courbes** des moyennes hebdomadaires.
- Toi : fiche → **Suivi et bilans** → **Journal quotidien**, avec **Exporter le journal (Excel / CSV)**.
- Fiche → **Infos et accès** → case **Journal quotidien** (cochée par défaut) pour l'activer ou non par cliente.

---

# Message à toutes tes clientes et rappel quotidien du journal

## 1. Mettre à jour la base de données (une seule fois)

[`0014_annonces_rappel_journal.sql`](../supabase/migrations/0014_annonces_rappel_journal.sql) → **Copy raw file** → Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

## 2. Mettre l'horloge en route (une seule fois)

Les rappels du journal partent à l'heure choisie par chaque cliente : Supabase appelle l'app toutes les 15 minutes.

[`horloge-rappels.sql`](../supabase/horloge-rappels.sql) → **Copy raw file** → Supabase → **SQL Editor** → **New query** → colle → **Run** → « Success ». Supabase crée lui-même la clé qui protège cet appel : rien à copier ailleurs.

Pour vérifier, le lendemain : Supabase → **Integrations** → **Cron** (ou Database → Cron Jobs) → « rappels-journal » doit avoir des exécutions réussies.

## Utilisation

- **Message à toutes** : tableau de bord → **Un message à toutes mes clientes** → ton texte, la page où elle arrive en touchant le message (communauté, journal…) → **Envoyer**. Notification à celles qui les ont activées, et un mot « Un mot de Cindy » sur l'accueil de toutes pendant 24 h (elles peuvent le fermer). **Retirer** l'enlève avant la fin.
- **Rappel du journal** : chaque cliente le règle dans **Mon journal** → « Me le rappeler chaque jour » (20 h 30 par défaut, ou l'heure qu'elle veut, ou coupé). Notification seulement (pas d'email), une fois par jour, et rien si sa journée est déjà remplie. Il faut qu'elle ait activé les notifications dans son profil.

---

# Plan alimentaire dans l'app (à la place de Nutrium)

## 1. Mettre à jour la base de données (une seule fois)

[`0015_plan_alimentaire.sql`](../supabase/migrations/0015_plan_alimentaire.sql) → **Copy raw file** → Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

## 2. Faire un plan

Fiche de la cliente → carte **Plan alimentaire** → **Faire son plan alimentaire**.

1. **Ses besoins** (visibles par toi seulement) : sexe, date de naissance, taille, poids actuel (pré-rempli avec son journal) et objectif, formule (Black par défaut), activité actuelle et visée. L'app calcule le métabolisme de base et la dépense ; tu choisis l'objectif calorique (ou **Prendre … kcal**), puis la répartition lipides / glucides / protéines avec les curseurs (grammes et g/kg calculés) et les fibres. **Enregistrer les besoins**.
2. **Nouveau plan** : vide (avec les repas de sa fiche) ou **copie** d'un plan existant, même d'une autre cliente. Les recommandations de ton dernier plan sont reprises.
3. Dans l'éditeur, pour chaque repas : l'heure, le nom, **Ajouter un aliment** (recherche Ciqual + tes aliments), la quantité en grammes ou en unités (œuf, tranche…). **+ ou…** ajoute une alternative : la quantité équivalente est calculée toute seule (en calories, ou en protéines / glucides / lipides au choix). Si tu corriges une quantité à la main, elle ne bouge plus (**recalculer** pour revenir au calcul). Notes par repas, recommandations en bas.
4. À droite, l'**analyse** : calories, lipides, glucides, protéines, fibres du plan par rapport à ses objectifs, et la répartition par repas.
5. **Enregistrer** (ou Ctrl + S), puis **Publier pour …** : elle le voit dans son onglet **Nutrition** (et reçoit une notification si elle les a activées). **Mettre à jour son plan** republie après des changements ; **Retirer** l'enlève de son appli. **PDF** télécharge le plan.

Bon à savoir : en mode « sans chiffres », elle voit les quantités mais pas les calories ni les macros (dans l'app comme dans le PDF). Ses anciens plans PDF restent accessibles (lien « Voir mes anciens plans en PDF »). Les fibres s'afficheront quand la table Ciqual aura été remise à jour (le site de l'ANSES était en maintenance).

---

# Programme sportif construit avec Claude

## 1. Mettre à jour la base de données (une seule fois)

[`0016_programme_sportif.sql`](../supabase/migrations/0016_programme_sportif.sql) → **Copy raw file** → Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

## 2. Faire un programme

Fiche de la cliente → carte **Programme sportif** → **Son programme sportif**.

1. **Copier la consigne pour Claude** → colle-la au début d'une conversation Claude. Astuce : crée une fois pour toutes un **projet Claude** « Programmes sportifs » et colle la consigne dans ses instructions ; chaque nouvelle conversation du projet la connaîtra.
2. Décris ta cliente à Claude (objectif, niveau, matériel de la box, nombre de séances, blessures…) **sans son nom**, et construisez le programme ensemble.
3. Quand il te convient, écris **« format application »** : Claude répond avec le programme dans un bloc de code.
4. Copie **toute** sa réponse → colle-la dans l'app → **Importer le programme** → tu vois l'aperçu tel qu'elle le verra.
5. **Publier pour …** : elle le voit dans son onglet **Sport** (et reçoit une notification si elle les a activées).

**Tu as déjà le programme en PDF ?** Dans ta conversation Claude (avec la consigne), joins le PDF et écris : *« Retranscris ce programme au format application »*. Claude le recopie fidèlement ; tu colles sa réponse dans l'app comme d'habitude. Pense à recopier la consigne à jour (bouton **Copier la consigne pour Claude**) dans les instructions de ton projet Claude : elle explique maintenant comment écrire les séries, les repos et les formats pour le mode séance.

Pour **modifier** : sur la page du programme, **Copier le programme pour Claude** → colle-le dans Claude avec tes changements → colle sa réponse dans **Remplacer par cette version** → **Republier**.

Bon à savoir : le suivi sportif doit être coché dans la fiche, sinon elle n'a pas d'onglet Sport. Si un exercice porte le même nom qu'une vidéo de ta bibliothèque (ex. « Squat goblet »), elle aura un bouton **Voir la vidéo**. Ses anciens programmes PDF restent accessibles.

---

# Revenus

## 1. Mettre à jour la base de données (une seule fois)

[`0017_revenus.sql`](../supabase/migrations/0017_revenus.sql) → **Copy raw file** → Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

## 2. Utilisation

Menu **Revenus** :

- **En haut** : encaissé dans l'année (et ce qui était prévu), ce mois-ci, moyenne par mois, ce qu'il reste à encaisser (dont en retard). Flèches pour changer d'année.
- **Mois par mois** : encaissé (à la date réelle du virement) et prévu (à la date d'échéance). Touche un mois pour ne voir que ses encaissements ; « Voir le tableau » donne les chiffres.
- **À encaisser** : les retards d'abord. **Encaissé** → choisis la vraie date du virement. **Reporter / modifier** → nouvelle date prévue, montant, note (« report demandé par la cliente »…).
- **Encaissements** : tout ce qui est rentré ; **Modifier** pour corriger une date ou un montant (ou annuler un encaissement en décochant « Encaissé »).
- **Ajouter un revenu** : ce qui n'est pas dans un échéancier (séance ponctuelle, atelier, ebook…), avec ou sans cliente.
- **Par formule / par moyen de paiement** : d'où viennent tes revenus.
- **Exporter (Excel)** : tous les encaissements de l'année avec le total, pour ta comptabilité.

Les mêmes boutons sont dans la fiche de chaque cliente (Formule et paiement). Bon à savoir : enregistrer la formule ne touche plus aux dates que tu as reportées, sauf si tu changes le montant, le nombre de fois ou la date du 1er paiement.

---

# Changement de programme sportif (toutes les 6 semaines)

## 1. Mettre à jour la base de données (une seule fois)

[`0018_renouvellement_programme.sql`](../supabase/migrations/0018_renouvellement_programme.sql) → **Copy raw file** → Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

Les programmes déjà publiés reçoivent automatiquement une date de changement 6 semaines après leur publication.

## 2. Utilisation

- Quand tu **publies un nouveau programme**, le prochain changement est prévu **6 semaines plus tard**. Republier le même programme après une correction ne change pas la date.
- **Tableau de bord** : la carte « Programmes sportifs à changer » liste les changements en retard ou dans les 14 jours.
- **Rappel** : le matin, 7 jours avant, 3 jours avant, le jour même, puis tous les 3 jours pendant 2 semaines tant que le suivant n’est pas dans l’appli, tu reçois une notification (et un email si tu les as activés dans Réglages → Notifications). Plusieurs clientes le même jour = un seul message.
- **Reporter** (vacances, blessure…) : ouvre son programme → carte **Changement de programme** → choisis une date, ou **Reporter d'une semaine**. Les rappels suivent la nouvelle date.
- **Fiche cliente** : « Semaine 3 sur 6 · prochain programme le … ». Ta cliente voit aussi « Semaine 3 sur 6 » dans son onglet Sport.

---

# Mode séance (la cliente suit sa séance pas à pas)

## 1. Mettre à jour la base de données (une seule fois)

[`0019_seances_faites.sql`](../supabase/migrations/0019_seances_faites.sql) → **Copy raw file** → Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

Sans cette mise à jour, le mode séance fonctionne, mais les séances validées ne sont pas enregistrées.

## 2. Comment ça marche pour ta cliente

Onglet **Sport** → elle ouvre une séance → **▶ Commencer la séance** :

1. **Échauffement**, puis **C'est parti**.
2. **Chaque série** s'affiche en grand : exercice, série 2/4, répétitions, charge, tempo, consignes, lien vers la vidéo.
3. Elle touche **Fait ✓ · Repos 1:30** : le **minuteur de repos** démarre (−15 s / +15 s / Passer). À la fin : bip + vibration, et **la série suivante s'affiche toute seule**. Ainsi de suite, exercice après exercice.
4. **Circuits** (« 3 tours ») : les exercices s'enchaînent, puis on recommence. **AMRAP / EMOM / For time / Tabata** : un grand minuteur pour le bloc (bip à chaque minute en EMOM, chrono « J'ai fini ! » en For time).
5. **Séance terminée** : elle choisit son ressenti (de 😌 très facile à 🥵 très dur), peut t'écrire un mot, puis **Valider ma séance**.

L'écran reste allumé pendant la séance. Si elle quitte l'appli (pour regarder une vidéo par exemple), elle reprend là où elle s'était arrêtée.

## 3. Ce que tu vois

- Page **Programme sportif** de la cliente : carte **Séances faites** (date, durée, ressenti, son mot).
- **Fiche cliente** : « 3 séances faites ces 7 derniers jours · dernière : … ».
- Sur la page d'un programme, **▶ Tester le mode séance** te montre exactement ce qu'elle verra (rien n'est enregistré).

Pour que le guidage soit juste, chaque exercice de force doit avoir **series** (un chiffre) et **repos** (« 90 s », « 2 min ») : la consigne Claude le demande déjà.

---

# Programmes planifiés (tous les programmes d'un coup, mis en ligne toutes les 6 semaines)

## 1. Mettre à jour la base de données (une seule fois)

[`0020_programmes_planifies.sql`](../supabase/migrations/0020_programmes_planifies.sql) → **Copy raw file** → Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

## 2. Préparer tous ses programmes d'un coup

1. Vérifie la **date de début du coaching** dans sa fiche (Infos) : le planning part de cette date.
2. Dans Claude (avec la consigne à jour), joins **tous ses PDF** et écris : *« Retranscris ces programmes au format application, un bloc par programme, dans l'ordre »*.
3. Copie toute la réponse → fiche → **Programme sportif** → colle → **Importer le programme** : tous les programmes sont créés en brouillon.
4. Carte **Planning des programmes** → **Planifier toutes les 6 semaines**. Le programme de la période en cours passe en ligne tout de suite (si elle n'en a pas déjà un), les suivants prennent chacun une date, 6 semaines après le précédent.
5. Une date à changer (vacances, blessure) ? Modifie-la dans le planning → **Planifier**. **Retirer du planning** le remet en brouillon.

## 3. Ce qui se passe ensuite (tout seul)

- Un programme planifié **reste caché** à ta cliente jusqu'à sa date.
- **3 jours avant** : elle reçoit une notification « Ton nouveau programme sportif arrive vendredi 20 novembre (dans 3 jours) » et voit un encadré dans son onglet Sport.
- **Le jour J** : le nouveau programme remplace l'ancien (le matin, ou dès qu'elle ouvre l'onglet Sport) et elle reçoit « Ton nouveau programme sportif est là 💪 ».
- Tu n'as plus le rappel « programme à changer » pour cette cliente : le changement est déjà prévu.

---

# Poids utilisés (mode séance)

## 1. Mettre à jour la base de données (une seule fois)

[`0021_charges_series.sql`](../supabase/migrations/0021_charges_series.sql) → **Copy raw file** → Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

## 2. Pour ta cliente

Sur chaque série du mode séance, un champ **Poids utilisé** (boutons − / + d'un kilo, ou elle tape le poids, ex. 15,5).

- **La dernière fois (dim. 15 nov.) : 12 · 12 · 14 · 14 kg** s'affiche sous le champ, la série en cours en gras.
- Le poids est **proposé** : celui de sa série d'avant, sinon celui de la même série la dernière fois. Si elle ne change rien, **Fait ✓** l'enregistre tel quel.
- Exercice sans charge prévue (gainage, rameur…) : le champ est replié, **+ Noter le poids utilisé** l'ouvre.
- À la fin : **Tes poids du jour**, exercice par exercice.

Chaque poids est enregistré dès qu'elle touche **Fait ✓** (et renvoyé à la validation si le réseau avait coupé). Elle le retrouve sur n'importe quel téléphone.

## 3. Pour toi

Page **Programme sportif** de la cliente → carte **Poids utilisés** : pour chaque exercice, sa dernière séance, la précédente, et la progression (ex. **+1,5 kg**).

---

# Analyse & conseils (par cliente)

## 1. Mettre à jour la base de données (une seule fois)

[`0022_besoins_objectif.sql`](../supabase/migrations/0022_besoins_objectif.sql) → **Copy raw file** → Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

## 2. Pour des conseils complets

Dans **Plan alimentaire → Ses besoins**, renseigne : taille, date de naissance, poids, **son objectif** (perte, maintien, prise de masse, recomposition) et **ce qu'elle mange aujourd'hui** (estimation en kcal/jour, d'après son journal alimentaire ou Nutrium).

## 3. Ce que fait l'analyse

Fiche cliente → carte **Analyse & conseils** → **Voir l'analyse et les conseils**. L'appli croise ses pesées et mensurations (bilans + journal), ses ressentis (énergie, sommeil, stress, faim, « le plan me convient ? »), son journal (pas, sommeil, eau, digestion), son plan alimentaire, ses séances et ses charges :

- **Chiffres clés** : poids et évolution, rythme sur 4 semaines (kg et % par semaine), tour de taille, calories (mange / objectif / dépense), protéines en g/kg, séances par semaine, pas, sommeil.
- **Plan de départ progressif** quand elle mange nettement sous ses besoins : +100 kcal par semaine jusqu'à sa maintenance, avec les paliers semaine par semaine.
- **Conseils**, classés « À traiter en priorité », « À surveiller », « Bon à savoir » et « Ses réussites » : stagnation (vérifications, puis −5 %, diet break après 12 semaines de déficit), recomposition (poids stable mais taille qui baisse : ne rien couper), perte trop rapide, prise de masse qui ne monte pas, déficit trop fort, objectif sous le métabolisme de base, protéines basses, besoins à recalculer, plan ancien, fatigue, sommeil, stress, faim, plan qui ne convient pas, peu de pas, activité en baisse, hydratation, digestion, séances manquées, charges qui stagnent, bilans manqués, fin de suivi…

Ce sont des pistes calculées à partir de repères de coaching courants : elles ne remplacent ni ton jugement ni un avis médical.

---

# Garder le contact (propositions de messages)

## 1. Mettre à jour la base de données (une seule fois)

[`0023_messages_cliente.sql`](../supabase/migrations/0023_messages_cliente.sql) → **Copy raw file** → Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

## 2. Utilisation

Sur ton **tableau de bord**, carte **Garder le contact 💬** : ce qui a changé cette semaine par rapport à la semaine d'avant (d'après son journal et ses séances), avec un petit mot prêt à envoyer.

- **À relancer** : elle bouge moins (NEAT en baisse), dort moins, est plus stressée, boit moins, ne remplit plus son journal, n'a fait aucune séance.
- **À féliciter** : plus de pas, meilleur sommeil, séances régulières, courbe de poids qui descend (jamais si elle est en mode sans chiffres).

Pour chaque proposition, modifie le texte si tu veux, puis :
- **Envoyer dans l'appli** : elle reçoit une notification et voit « Un mot de Cindy » sur son accueil pendant 14 jours ;
- **Copier** : pour l'envoyer toi-même (WhatsApp, Instagram…) ;
- **Ignorer**.

Une proposition traitée ne revient pas de la semaine.

---

# Petit mot du jour

Rien à installer, aucune mise à jour de la base.

- À la **première ouverture de l'appli dans la journée**, ta cliente voit une petite fenêtre « Ton petit mot du jour », signée Cindy 💛. Elle la ferme avec « Merci, belle journée ✨ ».
- La phrase reste ensuite toute la journée sous « Bonjour … » sur son accueil.
- La phrase change chaque jour : la même pour toutes tes clientes, et aucune ne revient avant d'avoir fait le tour des 100 phrases (environ 3 mois).
- Pour modifier ou ajouter des phrases : fichier `src/lib/encouragements.ts` (une phrase par ligne, entre guillemets).

---

# Relance programme sportif

Rien à installer.

Tant que le **programme suivant n'est ni en ligne ni planifié** dans l'appli, tu reçois un rappel (notification, et email si activés dans Réglages → Notifications) :
- **7 jours avant** la fin de son programme ;
- **3 jours avant** : « le suivant n'est pas encore dans l'appli » ;
- **le jour J** ;
- puis une **relance tous les 3 jours** pendant 2 semaines si rien n'a bougé.

Les relances s'arrêtent dès que tu publies ou planifies son prochain programme, ou si tu reportes la date de changement. La cliente apparaît aussi dans ton tableau de bord (« en retard » si la date est passée).

---

# Notifications : tout ce qui se passe dans l'appli

## 1. Mettre à jour la base de données (une seule fois)

[`0024_notifications_coach_tout.sql`](../supabase/migrations/0024_notifications_coach_tout.sql) → **Copy raw file** → Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

## 2. Choisir ce que tu reçois

**Réglages → Mes notifications** : tout est coché au départ, décoche ce que tu ne veux pas.

- **Note à lire vite ⚠️** : une cliente écrit, dans les notes de sa journée ou en commentaire de séance, quelque chose qui parle de **douleur / blessure**, de **santé** (malaise, médecin, enceinte…), de **moral ou de rapport à la nourriture** (crise, angoisse, envie d'abandonner…) ou d'une **demande pour toi** (« urgent », « appelle-moi », une question à Cindy…). Notification + email. Elle apparaît aussi en tête de ton tableau de bord pendant 3 jours.
- **Bilan envoyé** (notification + email).
- **Journée remplie** : une fois par jour et par cliente (notification seulement).
- **Séance de sport faite** (notification seulement).
- **Programme sportif à changer** : 7 j et 3 j avant, le jour J, puis relance tous les 3 jours (notification + email).
- **Message signalé** et **nouveau message dans la communauté**.
- **Recevoir aussi un email**.

Pour la confidentialité, la notification ne recopie jamais ce que la cliente a écrit : elle dit seulement de quoi il s'agit. Tu lis le texte dans l'appli.

Le repérage se fait par mots-clés : il ne remplace pas ta lecture, mais il te prévient vite quand quelque chose ressemble à une alerte.

---

# Sauvegarde complète et tâche du matin indépendante de l'hébergeur

## 1. Mettre à jour la base de données (une seule fois)

[`0025_tache_du_matin.sql`](../supabase/migrations/0025_tache_du_matin.sql) → **Copy raw file** → Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

## 2. Mettre l'horloge du matin en route (une seule fois)

Jusqu'ici, les rappels de bilan, de paiement et la mise en ligne des programmes planifiés partaient grâce à Vercel. Si tu passes sur Netlify, Vercel ne les lancera plus. Désormais, c'est **Supabase** qui les lance chaque matin à **7 h (heure de Paris)**, quel que soit l'hébergeur.

[`horloge-rappels.sql`](../supabase/horloge-rappels.sql) → **Copy raw file** → Supabase → **SQL Editor** → **New query** → colle → **Run** → « Success ».

- C'est le même fichier que pour les rappels du journal : le relancer est sans danger, il ajoute simplement l'horloge du matin.
- L'adresse de l'app est écrite dans ce fichier (`https://app.fitw-cindy.fr`). Si ton adresse change un jour, remplace-la aux deux endroits avant de cliquer sur **Run**.
- Vercel (ou Netlify) garde sa propre tâche du matin, en secours. **Rien ne part en double** : le premier passage du jour fait le travail, les suivants voient « déjà faite » et ne font rien. Si un passage échoue, le suivant reprend.

## 3. Vérifier que la tâche a bien tourné

Le lendemain matin :
- **Dans l'app** : **Réglages** → carte **Rappels de bilan** → « Tâche du matin : dernier passage lundi 24 novembre à 07:00 (horloge Supabase) · ✓ terminée ».
- **Dans Supabase** : **Integrations** → **Cron** (ou Database → Cron Jobs) → « tache-du-matin » : deux exécutions par jour (à 5 h et 6 h, heure anglaise), toutes « Succeeded ». C'est normal : une seule des deux appelle l'app, celle qui tombe à 7 h à Paris (l'heure change entre l'été et l'hiver).
- Si la ligne dans Réglages affiche **⚠️ en échec**, la tâche sera relancée au passage suivant (Vercel ou Netlify dans la matinée, sinon le lendemain). Si ça se répète, préviens-moi.

## 4. La sauvegarde est maintenant complète

**Réglages** → **Télécharger une sauvegarde** contient désormais toutes les tables : plans alimentaires, programmes sportifs, séances faites et poids utilisés, besoins, revenus, messages, annonces, communauté…

Seules exceptions, volontaires :
- les **listes de courses** (privées, tu n'y as pas accès) ;
- les **abonnements aux notifications** (adresses techniques des téléphones, inutiles ailleurs).

Rappel : les **fichiers** (PDF, photos) ne sont pas dans la sauvegarde, seulement leur emplacement. Ils restent dans Supabase → **Storage**. Pour en garder une copie, télécharge-les depuis cet écran.

Une vérification automatique empêche désormais d'oublier une nouvelle table dans la sauvegarde.

## 5. Tester

1. **Réglages** → **Télécharger une sauvegarde** → ouvre le fichier avec un éditeur de texte : en haut, `"tables_illisibles": []` doit être vide (sinon, une mise à jour de la base n'est pas faite) et `"tables_exclues"` liste les 3 exceptions.
2. Le lendemain de l'étape 2 : la ligne « Tâche du matin » dans **Réglages** (voir l'étape 3).
3. Les tests des parcours principaux (connexion, bilan, recette, bilan côté coach) se lancent sur l'ordinateur du développeur avec `npm run test:e2e` : ils utilisent une base simulée, jamais ta vraie base.

---

# Formulaire Tally, contrat dans l'app, brouillon de réponse par Claude

## 1. Mettre à jour la base de données (une seule fois)

Pour chacun de ces 3 fichiers, dans l'ordre : lien → **Copy raw file** → Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

1. [`0026_demandes_inscription.sql`](../supabase/migrations/0026_demandes_inscription.sql) (formulaire Tally)
2. [`0027_contrat.sql`](../supabase/migrations/0027_contrat.sql) (contrat)
3. [`0028_brouillon_claude.sql`](../supabase/migrations/0028_brouillon_claude.sql) (brouillon Claude)
4. [`0029_contrat_variables.sql`](../supabase/migrations/0029_contrat_variables.sql) (contrat rempli pour chaque cliente)

## 2. Formulaire Tally → fiche « à valider »

Chaque réponse à ton formulaire d'inscription Tally crée une **fiche à valider** dans **Clientes**. La personne ne reçoit rien : tu vérifies, puis tu cliques sur **Vérifier et inviter**.

**A. Préparer les questions de ton formulaire.** L'app reconnaît les questions par les mots de leur intitulé :

| Champ de la fiche | L'intitulé de la question doit contenir… | Exemple |
|---|---|---|
| Prénom (obligatoire) | « prénom » | « Ton prénom » |
| Nom | « nom » | « Ton nom » |
| Email (obligatoire) | « email » ou « e-mail » (ou une question de type *Email*) | « Ton adresse email » |
| Objectif | « objectif » | « Quel est ton objectif principal ? » |
| Exclusions | « allergies », « intolérances », « évites », « n'aimes pas »… | « Allergies ou aliments que tu évites ? » |

- Toutes les autres questions (rythme de vie, sport, etc.) sont gardées telles quelles : tu les lis dans « Toutes ses réponses ».
- Pour l'objectif, l'app reconnaît « perdre », « tonifier », « prise de masse », « stabiliser »… Sinon, tu le choisis toi-même dans ses besoins.
- Pour les exclusions, l'app propose des catégories : gluten, lactose → produits laitiers, végétarienne → viandes et poissons, cacahuètes → arachide, etc. Tu les vois avant de créer la fiche, et tu peux tout corriger ensuite.

**B. Brancher Tally à l'app** (une seule fois)
1. Tally → ton formulaire → onglet **Integrations** → **Webhooks** → **Connect**.
2. **Endpoint URL** : `https://app.fitw-cindy.fr/api/tally`
3. Active **Signing secret**. Écris une longue suite de lettres et de chiffres au hasard (ou garde celle que Tally propose) et **copie-la**.
4. Vercel → ton projet → **Settings** → **Environment Variables** → **Add** : nom `TALLY_SIGNING_SECRET`, valeur = la suite copiée, coche **Sensitive** → **Save**. Puis **Deployments** → **⋯** → **Redeploy**.
   (Le jour où tu passes sur Netlify, ajoute la même variable dans Netlify.)
5. Dans Tally, clique sur **Save**.

**Doublons** : si la même personne envoie le formulaire deux fois, sa demande est mise à jour, sans en créer une deuxième. Si un compte existe déjà avec cet email, la fiche affiche « ⚠️ Un compte existe déjà », avec un lien vers sa fiche.

**Tester**
1. Remplis toi-même ton formulaire Tally avec une adresse de test.
2. Dans l'app : **Clientes** → en haut, **Fiches à valider (1)**, avec ses réponses et les exclusions proposées. Tu reçois aussi une notification « Nouvelle demande d'inscription » (case dans **Réglages → Mes notifications**).
3. **Vérifier et inviter** → le formulaire de création est pré-rempli. Ajuste si besoin → **Créer sa fiche et l'inviter**. L'email de connexion ne part que si la case « Lui envoyer tout de suite l'email de connexion » est cochée.
4. Si rien n'arrive : Tally → **Integrations** → 🕔 à côté du webhook → la liste des envois. « 401 » veut dire que la clé de signature ne correspond pas à celle de Vercel.

## 3. Contrat accepté dans l'app avant le premier accès

1. **Réglages** → **Mon contrat** :
   - **Numéro de version** : par exemple `1` ;
   - **Texte de ton contrat** : colle le texte complet ;
   - **Phrase de la case « renonciation »** : colle la phrase exacte de ton contrat ou de ton conseil juridique (l'app n'invente aucun texte juridique) ;
   - **Enregistrer le contrat**.
2. À sa première connexion, juste après l'écran sur ses données, une nouvelle cliente lit le contrat et coche **deux cases obligatoires** :
   - « J'ai lu et j'accepte le contrat ci-dessus (version 1) » ;
   - ta phrase de renonciation.

   On garde la version, le texte exact, la date et l'heure. On ne garde pas l'adresse IP, comme tu l'as choisi.
3. **Changer de contrat** : modifie le texte **et le numéro de version** (l'app refuse de changer le texte d'une version déjà acceptée).
   - Les nouvelles clientes acceptent la nouvelle version.
   - Celles qui ont déjà accepté une version ne sont pas redemandées.
   - Les clientes déjà en cours avant la mise en place du contrat ne sont jamais bloquées.
4. Sur la fiche d'une cliente, rubrique **Contrat** : la version acceptée, la date et l'heure, et **Télécharger la preuve (PDF)**. Le PDF contient ses nom et email, la version, la date, les deux cases cochées et le texte complet accepté.

**Tester** : crée une cliente de test (avec ta propre adresse email), connecte-toi avec elle sur ton téléphone, accepte l'écran des données puis le contrat. Ensuite, regarde sa fiche → **Contrat** → **Télécharger la preuve (PDF)**.

### Contrat rempli automatiquement pour chaque cliente

**Mettre à jour la base (une seule fois)** : [`0029_contrat_variables.sql`](../supabase/migrations/0029_contrat_variables.sql) → **Copy raw file** → Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

Dans le texte du contrat, écris ces mots avec les doubles accolades : l'app les remplace par les informations de chaque cliente.

| Écris | Remplacé par |
|---|---|
| `{{prenom}}` · `{{nom}}` · `{{email}}` | sa fiche |
| `{{adresse}}` | son adresse : elle la tape sur l'écran du contrat |
| `{{date_naissance}}` | sa date de naissance : elle la tape (pré-remplie si tu l'as saisie dans ses besoins) |
| `{{formule}}` · `{{montant_total}}` | sa fiche → Formule et paiement |
| `{{paiement}}` | « Intégral » ou « Échelonné (en 3 fois) » |
| `{{jour_echeance}}` | le jour du mois de ses versements (d'après son échéancier) |
| `{{date_debut}}` | la date de début de son coaching |
| `{{date}}` | la date à laquelle elle accepte |

- Remplis sa **Formule et paiement** avant de l'inviter : une information manquante s'affiche « — ».
- Sur sa fiche, rubrique **Contrat** → **Voir son contrat tel qu'elle le lira**.
- La preuve (PDF) contient le contrat **rempli**, exactement tel qu'elle l'a lu et accepté.

## 4. Brouillon de réponse au bilan par Claude (facultatif, désactivé par défaut)

Sur un bilan, le bouton **✨ Proposer un brouillon** demande à Claude une réponse écrite à ton nom (« je »). Le ton est chaleureux, avec :
- une priorité, puis un ou deux points secondaires ;
- ce qu'on laisse de côté pour l'instant ;
- un recadrage bienveillant si ce qu'elle raconte ne colle pas avec ses chiffres.

Le brouillon arrive dans ta zone de retour : tu le relis, tu le modifies, et **il ne part que quand tu cliques sur Envoyer**. Le bouton « Copier pour Claude » reste là.

**Ce qui est envoyé à Claude** : exactement le texte de « Copier pour Claude », c'est-à-dire ses réponses et ses mesures.
- Ni nom, ni email, ni photo, ni date précise ; son prénom est remplacé par « [prénom] » et remis seulement dans ta zone de retour.
- L'envoi se fait depuis le serveur de l'app, jamais depuis le téléphone ou l'ordinateur.

**Activer**
1. Crée un compte sur **platform.claude.com** → **API Keys** → **Create Key** → copie la clé (elle commence par `sk-ant-`). Ne la colle jamais ailleurs que dans Vercel.
2. Dans **Billing**, ajoute quelques euros de crédit et fixe une **limite de dépense mensuelle** (par exemple 5 €).
3. Vercel → **Settings** → **Environment Variables** → **Add** : `ANTHROPIC_API_KEY` = ta clé, coche **Sensitive** → **Save** → **Redeploy**.
4. Dans l'app : **Réglages** → **Brouillon de réponse par Claude** → active l'interrupteur.

**Coût approximatif** : environ **2 à 5 centimes par brouillon** (modèle Claude Opus 5.5, à 4 $ par million de mots-jetons lus et 20 $ par million écrits ; un bilan, c'est environ 2 000 jetons lus et 500 à 2 000 écrits). Avec 15 clientes et 2 bilans par mois, ça fait **environ 1 à 1,50 € par mois**. Tu ne paies que les brouillons demandés.

**Paragraphe à ajouter à ta politique de confidentialité** (à adapter avec ton conseil si besoin) :

> **Aide à la rédaction des retours de bilan.** Pour m'aider à rédiger mes retours, je peux transmettre le contenu de ton bilan (tes réponses et tes mesures) à Anthropic PBC, éditeur de l'outil d'intelligence artificielle Claude. Ce contenu est pseudonymisé avant l'envoi : il ne contient ni ton nom, ni ton adresse email, ni tes photos, ni de date précise. La proposition obtenue est toujours relue et modifiée par moi avant de t'être envoyée ; aucune décision n'est prise automatiquement. Anthropic agit en tant que sous-traitant, n'utilise pas ces données pour entraîner ses modèles et les supprime après une courte durée de conservation, selon ses conditions commerciales. Anthropic étant situé aux États-Unis, ce transfert est encadré par les clauses contractuelles types de la Commission européenne. Tu peux t'opposer à cet usage à tout moment en me l'écrivant : je rédigerai alors mes retours sans cet outil.

Avant de publier ce paragraphe, vérifie sur le site d'Anthropic leurs conditions actuelles (durée de conservation, accord de traitement des données) : elles peuvent évoluer.

**Tester** : ouvre un bilan reçu → **✨ Proposer un brouillon** → en 10 à 60 secondes, le texte apparaît, commençant par « Coucou [son prénom] ». Modifie-le, puis **Envoyer**.

---

# Séance sans réseau et questionnaire d'arrivée

## 1. Mettre à jour la base de données (une seule fois)

Pour chacun de ces 2 fichiers, dans l'ordre : lien → **Copy raw file** → Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

1. [`0030_seances_hors_connexion.sql`](../supabase/migrations/0030_seances_hors_connexion.sql) (séance sans réseau)
2. [`0031_questionnaire_arrivee.sql`](../supabase/migrations/0031_questionnaire_arrivee.sql) (questionnaire d'arrivée)
3. [`0032_questionnaire_precoaching.sql`](../supabase/migrations/0032_questionnaire_precoaching.sql) (ton questionnaire pré-coaching à la place des questions de départ)

## 2. Programme sportif et séance guidée sans réseau

Dans une salle en sous-sol, sans réseau, ta cliente peut quand même suivre sa séance guidée : minuteur, séries, poids notés.

- **Ce qui est gardé sur son téléphone** : seulement son onglet Sport (son programme en cours) et ses séances guidées. Il faut qu'elle ait ouvert l'onglet Sport **avec du réseau** au moins une fois depuis son dernier changement de programme.
- **Rien d'autre** n'est gardé : ni bilans, ni photos, ni mesures, ni recettes.
- **Les vidéos d'exercices** ne marchent pas sans réseau (elles sont sur YouTube).
- Un petit bandeau « **Hors connexion** » s'affiche en haut de l'écran.
- La séance validée sans réseau et les poids notés sont **gardés sur son téléphone**, puis **envoyés tout seuls** dès que le réseau revient, à la prochaine ouverture de l'app. Une séance n'est jamais comptée deux fois.
- **À la déconnexion**, tout ce qui est gardé sur le téléphone est effacé. S'il reste une séance pas encore envoyée, l'app la prévient avant.
- Sur iPhone, si l'app n'est pas ouverte pendant plusieurs semaines, l'iPhone peut effacer ce qui est gardé : il suffit de rouvrir l'onglet Sport avec du réseau.

**Tester sur iPhone (app installée sur l'écran d'accueil) puis sur Android**
1. Avec du réseau, connecte-toi avec une cliente de test qui a un programme sportif, ouvre l'onglet **Sport** et attends 5 secondes.
2. Active le **mode avion**.
3. Ferme l'app complètement, puis rouvre-la depuis l'icône → onglet **Sport** → ouvre une séance. Le bandeau « Hors connexion » apparaît, la séance se déroule normalement.
4. Note un poids, termine la séance et clique sur **Valider ma séance** : le message « Pas de réseau : ta séance est gardée sur ton téléphone… » s'affiche.
5. Coupe le mode avion et rouvre l'app : le bandeau indique l'envoi, puis disparaît.
6. Toi, sur sa fiche → **Programme sportif** : la séance apparaît dans les séances faites, à l'heure où elle a été faite, avec ses poids.
7. Profil → **Me déconnecter** : tout est effacé du téléphone.

## 3. Questionnaire d'arrivée

À sa première connexion, après le contrat, une nouvelle cliente remplit **ton questionnaire pré-coaching**, avec ton texte d'accueil (« Félicitations ma Queen ! 👑… ») :
- ton profil ;
- 1. mode de vie et quotidien ;
- 2. objectifs et motivations ;
- 3. santé ;
- 4. alimentation actuelle ;
- 5. relation à la nourriture ;
- 6. activité physique ;
- 7. plan alimentaire ;
- et « As-tu des questions ou observations ? ».

Comment certaines questions sont reprises :
- Nom, prénom et email ne sont pas redemandés : ils sont déjà dans sa fiche.
- Sa **taille**, son **poids** et sa **date de naissance** pré-remplissent ses besoins s'ils sont vides.
- En plus de ta question libre sur l'objectif et le délai, elle choisit **son objectif en un mot** (perte de gras, maintien, prise de muscle, tonification) : il pré-remplit sa fiche.
- **Photo des compléments** et **bilan sanguin** : la question lui demande de te les envoyer par message. Aucun document de santé n'est gardé dans l'app.
- **Ton plan alimentaire** (partie 7) : chaque famille s'affiche avec **tous ses aliments déjà cochés**. Elle décoche ceux qu'elle ne veut pas et écrit ceux à ajouter. Tu vois « Garde… / Retire… / Ajoute… » dans ses réponses.
- « T'entraînes-tu en salle ou chez toi ? » et le matériel à domicile ne sont posés qu'aux clientes **avec suivi sportif**.

- Les **catégories d'aliments cochées** sont ajoutées à ses exclusions de recettes, et son **objectif** est pré-rempli dans ses besoins s'il n'y en avait pas encore. Tu corriges tout depuis sa fiche.
- Les « autres aliments » écrits à la main restent dans ses réponses : ajoute-les toi-même dans « Aliments exclus ».
- Tu reçois une notification quand elle l'a rempli (case « Bilan envoyé » dans Réglages → Mes notifications).
- Sur sa fiche, rubrique **Questionnaire d'arrivée** : toutes ses réponses.
- Les clientes déjà en cours ne le voient pas.
- Ses réponses (dont le cycle) ne sont visibles que par elle et toi.

**Modifier les questions** : **Réglages** → **Questionnaire d'arrivée** → **Modifier les questions**.
- Tu peux changer le texte, l'aide, l'ordre, rendre une question obligatoire ou non, ne plus la poser, la supprimer, ou en ajouter une.
- Une question « Objectif » a toujours 4 réponses, dans l'ordre : perte de gras, maintien, prise de muscle, tonification. Tu peux changer leur texte, pas leur ordre.
- Une question « Liste d'aliments » : un aliment par ligne, tous affichés déjà cochés.
- Une question « Nombre » ou « Date » peut pré-remplir sa taille, son poids ou sa date de naissance.
- La case « Seulement si suivi sportif » réserve une question aux clientes qui ont le suivi sportif.
- Le **texte d'accueil** se modifie en haut de la page.
- La case en haut de la page active ou coupe le questionnaire pour les nouvelles clientes.

**Tester** : crée une cliente de test, connecte-toi avec elle. Après les écrans des données et du contrat, le questionnaire s'affiche. Remplis-le, puis regarde sa fiche : rubriques **Questionnaire d'arrivée** et **Aliments exclus**.

---

# Phase 4 : pour tes clientes, ensuite

## 1. Mettre à jour la base de données (une seule fois)

Pour chacun de ces fichiers, dans l'ordre : lien → **Copy raw file** → Supabase → **SQL Editor** → **New query** → efface tout → colle → **Run** → « Success ».

1. [`0033_recap_semaine.sql`](../supabase/migrations/0033_recap_semaine.sql) (récap de la semaine)

Les victoires hors balance n'ont besoin d'aucune mise à jour de la base.

## 2. Victoires hors balance

L'app repère toute seule ce qui progresse chez ta cliente, à partir de ce qu'elle remplit déjà, **sans jamais regarder le poids** :
- un **nouveau record de charge** sur un exercice (plus lourd que tout ce qu'elle a fait avant) ;
- sa **régularité** : 3, 4, 6, 8… semaines d'affilée avec au moins 2 séances ;
- un **cap de séances** : 10e, 25e, 50e, 100e séance… ;
- son **tour de taille** qui baisse depuis le début (fêté tous les 2 cm) ;
- son **mieux-être** : stress plus bas ou digestion meilleure que les 3 semaines d'avant.

Ce que ça donne :
- **Pour elle** : une carte « Ta victoire hors balance 🏆 » sur son accueil pendant 7 jours. Elle la range avec « Merci 💛 ».
- **Pour toi** : dans ton tableau de bord, rubrique **Garder le contact**, une ligne « Victoire 🏆 » avec les chiffres et un petit mot de félicitations prêt à envoyer (tu peux le modifier, le copier ou l'ignorer).
- En **mode sans chiffres**, ni la carte ni le mot proposé ne contiennent de nombre (« Ton tour de taille a diminué depuis le début »).

**Tester** : avec une cliente de test qui a un programme sportif, note un poids sur un exercice lors d'une séance, puis, plus de 7 jours après, un poids plus lourd sur le même exercice : la carte apparaît sur son accueil, et la ligne dans ton tableau de bord.

## 3. Récap de la semaine

Chaque **dimanche à 18 h**, ta cliente reçoit le récap de sa semaine (du lundi au dimanche) :
- les **séances** faites ;
- ses moyennes de **sommeil**, de **pas** et d'**hydratation** (tirées de son journal) ;
- une **phrase encourageante** qui colle à sa semaine (jamais culpabilisante).

Où elle le voit :
- en **notification**, si elle a activé les notifications sur son téléphone. Elle peut la couper dans **Profil → Mes autres notifications → Mon récap du dimanche** ;
- sur son **accueil**, une carte « Ton récap de la semaine est prêt » du dimanche 18 h au mardi soir ;
- à tout moment dans **Suivi → Mon récap de la semaine**, avec les semaines d'avant.

La notification part avec les rappels du journal (l'horloge Supabase qui tourne toutes les 15 minutes) : rien d'autre à mettre en route. Elle n'est envoyée qu'une fois par semaine, et seulement aux clientes en cours de suivi.

**Tester** : connecte-toi avec une cliente de test → **Suivi** → **Mon récap de la semaine**. Les chiffres de la semaine dernière s'affichent, et « ← Semaine d'avant » montre les précédentes. Un dimanche après 18 h, la notification arrive sur un téléphone où les notifications sont activées.
