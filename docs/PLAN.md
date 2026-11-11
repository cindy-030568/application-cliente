# Plan d'architecture — App clientes fitw_cindy

> Document de référence. Version 1 — **validée par Cindy le 09/11/2026**.

## 1. Décisions issues des réponses de Cindy

| Sujet | Décision |
|---|---|
| Clientes | 5-6 aujourd'hui, 15 visées à 1 an. Une seule coach. |
| Statuts cliente | **Active** (tout l'accès + rappels de bilan) · **Suivi terminé** (garde son compte : plans, formation si cochée, ressources, recettes, vidéos, historique de mesures ; plus de rappels) · **Accès fermé** (ne peut plus se connecter). Changement uniquement manuel par la coach. |
| Conservation | 3 ans après la fermeture de l'accès, puis suppression. Bouton « Supprimer définitivement » (droit à l'effacement). |
| Consentement | Écran de consentement à la 1ʳᵉ connexion, avec un lien vers la politique de confidentialité du site (à compléter pour mentionner l'app). |
| Messagerie | Aucune (WhatsApp). |
| Plans | Historique conservé pour **nutrition et sport**. Sources possibles : PDF dans l'app, lien Drive, lien Nutrium (nutrition). |
| Vidéos | Pas encore de vidéos → hébergement **Bunny Stream** (UE, ~1-2 €/mois, lecture protégée) ; YouTube non répertorié accepté en secours. |
| Filtres vidéos | Liste de départ, modifiable par la coach. |
| Recettes hors tolérance | Réglage coach « Masquer » / « Afficher avec badge ». **Par défaut : Masquer** (réponse 18). |
| Tolérance | Respectée **sur chaque macro** (P, G, L) : écart autorisé = max(±10 %, ±3 g), les deux valeurs étant réglables. |
| Quantités | Exprimées **crues** (mention « poids cru » affichée). |
| Repas | Chaque repas a ses propres cibles (Collation 1 ≠ Collation 2). Goûter et collation partagent les mêmes recettes. |
| Exclusions | Deux niveaux : catégories (viande, poisson, lactose, gluten, porc, fruits à coque…) + aliments précis. |
| Portions | Sélecteur « pour N portions ». |
| Mode inspiration | Oui : parcourir toutes les recettes, puis « Adapter à mon repas ». |
| Fruits | Quantité ajustée par le moteur pour atteindre les cibles, dans la fourchette min/max saisie. |
| Recettes de départ | ~50 recettes générées par Claude, chargées via un **fichier d'import**. |
| Mesures | La cliente modifie ses saisies ; la coach peut saisir à sa place ; vue avant/après des photos ; export CSV (compatible Excel). |
| Rappels | Message dans l'app + notification push (si l'app est installée et autorisée) + email Brevo. Calés sur la date de début, fréquence par cliente (14 j par défaut). |
| Formation | Notion protégée par invitation → l'app affiche seulement le lien. Carte verrouillée avec un message doux + bouton de contact si pas d'accès. |
| Ressources | Catégories modifiables (Guides, Listes de courses, Compléments, Fiches pratiques). |
| Navigation cliente | **Accueil / Nutrition / Recettes / Sport / Suivi** (Vidéos dans Sport ; Formation et Ressources sur l'Accueil). |
| Dashboard coach | Pensé pour ordinateur. App cliente pensée pour téléphone. |

## 2. Stack

| Brique | Choix | Pourquoi |
|---|---|---|
| Application | **Next.js (App Router) + TypeScript + Tailwind CSS** | Un seul projet pour l'app cliente, le dashboard coach et la logique serveur. |
| Base de données / Auth / Fichiers | **Supabase**, région **Paris (eu-west-3)** | Postgres + RLS, Auth sans mot de passe, Storage privé avec URLs signées. |
| Connexion | Email avec **lien magique + code à 6 chiffres** | Sur iPhone, une app installée (PWA) ne partage pas la session de Safari : le lien ouvre Safari, pas l'app. Le code tapé dans l'app règle ce problème. |
| Emails | **Brevo** (SMTP pour Supabase + emails de rappel) | Gratuit jusqu'à 300 emails/jour, expéditeur à ton nom. |
| Vidéos | **Bunny Stream** (ou YouTube non répertorié) | Européen, quelques euros par mois, aucune pub ni suggestion. |
| Lecture PDF | **pdf.js** (rendu des pages dans l'app) | Affichage fiable sur iPhone et Android, plus un bouton Télécharger. |
| Graphiques | Recharts | Courbes d'évolution des mesures. |
| Notifications | Web Push (clés VAPID, gratuit) + tâche planifiée Supabase (pg_cron) | Rappels de bilan. |
| Hébergement | Développement : **Vercel gratuit** (données de test uniquement). Mise en ligne : **Cloudflare Workers (~5 $/mois)** ou **Vercel Pro (20 $/mois)**, choix en phase 9. | L'offre gratuite de Vercel interdit l'usage commercial. |
| Tests | Vitest (moteur de calcul), Playwright (parcours principaux) | |

### Coûts estimés

| Poste | Pendant le développement | Après la mise en ligne |
|---|---|---|
| Supabase | 0 € (offre gratuite) | ~25 $/mois (Pro : sauvegardes quotidiennes, pas de mise en pause) |
| Hébergement | 0 € | ~5 $/mois (Cloudflare) ou 20 $/mois (Vercel Pro) |
| Bunny Stream | 0 € | ~1-2 €/mois |
| Brevo | 0 € | 0 € |
| Nom de domaine | — | ~10-15 €/an |
| **Total** | **0 €** | **~32 à 48 €/mois** |

## 3. Sécurité et RGPD

- **RLS sur toutes les tables.** Fonction `is_coach()` ; une cliente ne lit que les lignes où `cliente_id = auth.uid()`, et uniquement si son statut n'est pas « Accès fermé ».
- **Les notes privées sont dans une table séparée**, accessible à la coach seule (la RLS filtre des lignes, pas des colonnes).
- **Buckets privés** : `plans` et `photos` (chemin `cliente_id/…`), lus uniquement via des URLs signées de 5 minutes. Bucket `recettes` (photos de plats, non sensibles) en lecture publique.
- **Aucune donnée sensible dans les URLs** : identifiants opaques (UUID), pas de noms ni d'emails ; pas de mesures dans les logs.
- **Invitation par la coach uniquement** : inscription libre désactivée.
- **Tests automatisés de la RLS** : une cliente A ne peut pas lire les données de B (tests exécutés à chaque phase).
- Suppression définitive d'une cliente : données, fichiers et compte.

## 4. Schéma de base de données

```
profils            id (= auth.users.id) · role ('coach'|'cliente') · prenom · nom · email · created_at
clientes           id → profils · statut ('active'|'terminee'|'fermee') · date_debut · date_fin
                   · acces_formation (bool) · masquer_graph_poids (bool)
                   · frequence_bilan_jours (14) · prochain_bilan (date) · ferme_le (date)
notes_coach        id · cliente_id · contenu · created_at                     ← coach uniquement
consentements      cliente_id · version · accepte_le

plans              id · cliente_id · type ('nutrition'|'sport') · source ('pdf'|'drive'|'nutrium')
                   · fichier_path · url · titre · actif (bool) · created_at  ← historique = lignes inactives

repas_cibles       id · cliente_id · type_repas ('petit_dejeuner'|'dejeuner'|'gouter'|'diner'|'collation')
                   · libelle ('Collation 1') · ordre · proteines_g · glucides_g · lipides_g
                   · kcal (calculé : 4P + 4G + 9L)

categories_aliment id · nom (viande, poisson, lactose, gluten, porc, fruits à coque, œuf…)
aliments           id · source ('ciqual'|'perso') · code_ciqual · nom · proteines_100 · glucides_100
                   · lipides_100 · kcal_100 · nom_unite ('œuf') · poids_unite_g · actif
aliments_categories aliment_id · categorie_id
exclusions         id · cliente_id · aliment_id? · categorie_id?

recettes           id · titre · photo_path · temps_prep_min · etapes (liste) · publiee · created_at
recettes_repas     recette_id · type_repas
tags / recettes_tags   (rapide, batch cooking, végétarien, sucré, salé…)
recette_ingredients id · recette_id · aliment_id · role ('proteine'|'glucide'|'lipide'|'fixe'|'fruit')
                   · unite ('g'|'unite') · qte_base · qte_min · qte_max · pas · ordre · note
favoris            cliente_id · recette_id

videos             id · titre · fournisseur ('bunny'|'youtube') · video_ref · points_cles · erreurs · publiee
filtres_video      id · famille ('groupe'|'materiel'|'categorie') · nom · ordre
videos_filtres     video_id · filtre_id

categories_ressource id · nom · ordre
ressources         id · titre · categorie_id · description · url · visibilite ('toutes'|'certaines')
ressources_clientes ressource_id · cliente_id

champs_mesure      id · libelle · unite · ordre · actif · est_poids (bool)
mesures            id · cliente_id · date · commentaire · saisie_par · created_at
mesures_valeurs    mesure_id · champ_id · valeur
photos_progression id · mesure_id · cliente_id · angle ('face'|'profil'|'dos') · fichier_path

abonnements_push   id · cliente_id · endpoint · cles · created_at
reglages (1 ligne) lien_formation · tolerance_pct (10) · tolerance_g (3) · hors_tolerance ('masquer'|'badge')
                   · message_formation · lien_contact
```

## 5. Moteur de recettes

**Entrées** : la recette (ingrédients, rôles, bornes, pas), les cibles du repas (P, G, L), les réglages de tolérance.

1. **Variables** : la quantité de chaque ingrédient non `fixe`, bornée par [min, max]. Le `fruit` est ajusté comme les autres ingrédients pour coller aux cibles, dans sa fourchette [min, max] (si min = max, il est fixe).
2. **Optimisation** (moindres carrés bornés) : on minimise l'écart relatif sur P, G et L, plus un petit terme qui garde les quantités proches des proportions de la recette d'origine (pour éviter 0 g de pâtes et 400 g de poulet). Tous les ingrédients comptent dans toutes les macros.
3. **Arrondis** au pas de chaque ingrédient (5 g, 1 œuf…), puis une recherche locale (±1 pas par ingrédient) pour corriger l'écart créé par l'arrondi.
4. **Recalcul** des macros réelles après arrondi.
5. **Verdict** : compatible si **chaque** macro respecte |réel − cible| ≤ max(tolérance % × cible, tolérance g). Sinon la recette est masquée, ou affichée avec un badge selon le réglage.
6. **Exclusions** : toute recette contenant un aliment exclu (directement ou par sa catégorie) est retirée avant le calcul.

Code TypeScript pur, sans dépendance à la base, couvert par des tests unitaires sur des cas concrets que Cindy valide.

## 6. Écrans

### Cliente (mobile, barre d'onglets en bas)
- **Connexion** : email → lien ou code à 6 chiffres · consentement à la 1ʳᵉ connexion
- **Accueil** : « Bonjour Prénom » · rappel de bilan · cartes Plan alimentaire, Programme sportif, Recettes, Vidéos, Ma formation (ou verrouillée), Ressources · accès au profil
- **Nutrition** : plan actuel (PDF intégré + Télécharger, ou bouton Nutrium/Drive) · versions précédentes
- **Recettes** : « Quel repas veux-tu remplacer ? » → recettes compatibles → fiche personnalisée (ingrédients avec SES grammes, portions, étapes, macros en petit, favori) · onglets Inspiration et Favoris
- **Sport** : programme actuel + historique · bibliothèque d'exercices filtrable → fiche exercice (vidéo, points clés, erreurs fréquentes)
- **Suivi** : nouvelle saisie (+ photos) · graphiques (tous au même niveau, poids masquable) · tableau d'historique · avant/après
- **Profil** : notifications, installer l'app, confidentialité, déconnexion

### Coach (ordinateur, menu latéral)
- **Tableau de bord** : dernières saisies de mesures, bilans à venir
- **Clientes** : liste filtrée par statut · fiche avec onglets Infos & accès · Plans · Repas & cibles · Exclusions · Mesures · Notes privées · **Aperçu recettes** (voir ce que la cliente voit)
- **Recettes** · **Aliments** (recherche Ciqual + aliments perso) · **Import de recettes** (fichier)
- **Vidéos** · **Ressources**
- **Réglages** : lien formation, tolérance, comportement hors tolérance, champs de mesure, catégories, filtres vidéos, message et lien de contact

## 7. Phases

| # | Phase | Livrable testable |
|---|---|---|
| 0 | **Comptes** | Supabase (Paris) + Vercel créés, guidés pas à pas. |
| 1 | **Socle** | Projet, thème de la charte, connexion (lien + code), rôles, RLS + tests, création/invitation de clientes, statuts, consentement, navigation à onglets (écrans vides). |
| 2 | **Plans, formation, ressources** | Dépôt de PDF + historique, liens Drive/Nutrium, lecteur PDF, carte Formation (verrou), Ressources par catégorie et par visibilité. |
| 3 | **Suivi et bilans** | Bilan complet (mesures configurables + ressentis : sommeil, énergie, stress, faim, digestion, cycle + photos + commentaire), fenêtre d'ouverture avant chaque échéance, file des bilans coach (à traiter / manquants / traités), retour écrit de la coach, mode sans chiffres par cliente, graphiques, historique, comparatif photos, export CSV, alertes (bilans manqués, décrochage, fin de suivi à 15 jours), prochain rendez-vous sur l'accueil. |
| 4 | **Vidéos** | Bibliothèque, filtres, fiches exercice, intégration Bunny/YouTube. |
| 5 | **Aliments et recettes** | Import Ciqual, aliments perso et à l'unité, catégories d'exclusion, saisie des recettes, fichier d'import + les ~50 recettes de départ. |
| 6 | **Moteur de calcul** | Algorithme + tests unitaires sur des cas réels validés ensemble ; aperçu recettes dans la fiche cliente. |
| 7 | **Recettes côté cliente** | Choix du repas, liste compatible, fiche personnalisée, portions, favoris, inspiration, exclusions, **liste de courses** générée depuis les recettes choisies. |
| 8 | **Rappels et PWA** | Installation sur l'écran d'accueil, icône, notifications push, emails Brevo, **relance automatique des bilans non envoyés**. |
| 9 | **Finitions et mise en ligne** | Passe design, accessibilité, nom de domaine, Supabase Pro, hébergement de production, vérification RGPD. |

Après chaque phase : démonstration, mode d'emploi pour tester, puis attente du feu vert.

## 8. Version 2 (après la mise en ligne)
Inspirées de l'étude d'Ecrine (11/11/2026), validées par Cindy :
- Questionnaire d'arrivée (habitudes, objectifs, allergies, cycle) qui pré-remplit les exclusions.
- Compléments : prises, moments, rappels discrets.
- Séances guidées : exercice par exercice, séries, charges, minuteur de repos, remontée chez la coach.
- Contrat signé en ligne avant l'accès.
- Parrainage et avis clientes.

Écartées volontairement : messagerie intégrée (WhatsApp), « repas respecté oui/non » et taux de conformité, courbe des calories, CRM de prospects.

## 9. Plus tard (hors v1)
- Intégration API Nutrium : seulement si une API publique existe, à vérifier et à confirmer avec Cindy.
- Intégration API Google Drive.
