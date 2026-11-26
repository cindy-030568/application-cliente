# Espace abonnées : le plan validé

Deux publics dans la même application :

1. **Les clientes coachées** (coaching nutrition, ou nutrition + sport) : accès **à vie** à toute l'application après leur suivi (ressources, audios, communauté, séances express, défis). Aucun abonnement pour elles.
2. **Les abonnées** : des femmes qui ne suivent pas le coaching et s'abonnent pour accéder à un espace construit à part, sans rien de personnalisé.

## Décisions

- **Paiement** : Stripe, au mois ou à l'année, **sans essai gratuit**. Elle gère seule son abonnement (carte, factures, résiliation) depuis l'espace sécurisé de Stripe. Accès jusqu'à la fin de la période payée.
- **Avant de résilier** : proposer une **pause d'un mois**, ou le passage à l'année.
- **Après l'arrêt** : espace fermé, données (journal, favoris, planning) **gardées 6 mois** pour qu'elle retrouve tout si elle revient, puis effacées.
- **Passerelle** : un bouton « Passer au coaching » toujours visible côté abonnées (vers la page d'inscription habituelle, sans remise).
- **Communauté** : un **espace commun** à toutes (abonnées et coachées), et un **salon réservé aux coachées**.
- Toujours hors périmètre : pas de suivi des calories, pas de scan d'aliments, pas de calcul des macros pour les abonnées, pas de catalogue de programmes génériques. Aucun contenu, nom ni texte copié d'autres applications.

## Ce que les abonnées ont

- **Mon métabolisme** : métabolisme de base et besoins du quotidien, comme un repère (pas un compteur de calories).
- **Recettes** de la coach avec des portions à la « méthode de l'assiette » (sans macros), favoris.
- **Séances express** et **défis du mois**.
- **Ressources et audios** marqués « pour les abonnées ».
- **Journal simple** (eau, sommeil, pas, énergie), récap du dimanche, victoires.
- Ce qu'elles n'ont pas : plan alimentaire personnalisé, programme sportif, bilans, messages privés avec la coach, calcul des macros.

## Ce qui les fait rester

- **Thème du mois** : audio, fiche, défi et recettes débloqués au fil des semaines.
- **Visio mensuelle** avec la coach (lien et rappel dans l'appli) et ses **replays** en audio.
- **Ma question à Cindy** : une question par abonnée et par mois ; réponse en visio ou en court audio.
- **Menu de la semaine** + **batch cooking du dimanche** (plan de préparation) + liste de courses en un clic.
- **Avec ce que j'ai** : elle coche ce qu'elle a dans son frigo, l'appli propose les recettes possibles.
- **Mon bilan du mois** : énergie, sommeil, pas, défis, séances, comparés au mois d'avant.

## Étapes (une à la fois, démo puis feu vert)

1. ✅ Accès à vie des coachées (suivi terminé = tout, sans date).
2. ✅ Socle abonnées : statut « abonnée », inscription seule + Stripe (mensuel / annuel), accès selon l'abonnement, gérer / pause / résilier, données gardées 6 mois, liste des abonnées côté coach, bouton « Passer au coaching ».
3. ✅ Espace abonnées : métabolisme, recettes sans macros, ressources « pour les abonnées », journal simple, séances express, défis, communauté commune + salon coachées.
4. Cuisine : menu de la semaine, batch cooking du dimanche, « Avec ce que j'ai ».
5. Lien avec la coach : thème du mois, visio mensuelle + replays, « Ma question à Cindy ».
6. Fidélité : « Mon bilan du mois », pause proposée avant de résilier.

## À faire par la coach (avant l'étape 2)

- Un compte Stripe professionnel, avec un produit « abonnement » et deux prix (mensuel, annuel).
- Les clés Stripe dans Vercel (jamais dans un message).
- Des conditions de vente pour l'abonnement (droit de rétractation de 14 jours pour un service en ligne, et son renoncement si l'accès commence tout de suite), et la politique de confidentialité mise à jour : à faire relire par un professionnel.
