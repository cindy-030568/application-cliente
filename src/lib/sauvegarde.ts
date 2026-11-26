/**
 * Contenu de la sauvegarde de la coach (Réglages → Télécharger une sauvegarde).
 *
 * RÈGLE : toute nouvelle table créée dans supabase/migrations doit être ajoutée ici,
 * soit dans TABLES_SAUVEGARDEES, soit (exception justifiée) dans EXCLUSIONS.
 * Un test (sauvegarde.test.ts) échoue si une table est oubliée.
 *
 * Les fichiers (PDF, photos) restent dans Supabase Storage : seuls leurs chemins sont exportés.
 */

/** Tables exportées, dans l'ordre (les tables « parentes » avant celles qui en dépendent). */
export const TABLES_SAUVEGARDEES = [
  // Réglages et comptes
  "reglages", "profils", "clientes", "consentements", "acceptations_contrat", "notes_coach", "demandes_inscription",
  // Plans PDF / liens et ressources
  "plans", "categories_ressource", "ressources", "ressources_clientes", "ressources_favoris", "ressources_ecoutes",
  // Bilans et suivi
  "questions_arrivee", "reponses_arrivee",
  "champs_mesure", "bilans", "bilan_valeurs", "photos_bilan", "retours_bilan", "journal_quotidien",
  // Vidéos
  "filtres_video", "videos", "videos_filtres",
  // Aliments, recettes, cibles
  "categories_aliment", "aliments", "aliments_categories", "repas_cibles", "exclusions",
  "tags", "recettes", "recettes_repas", "recettes_tags", "recette_ingredients", "favoris",
  // Séances express (séances de secours) : avant les séances faites qui y renvoient
  "seances_express", "seances_express_clientes", "seances_express_favoris",
  // Plan alimentaire et programme sportif construits dans l'app
  "besoins_clientes", "plans_alimentaires", "programmes_sportifs", "seances_faites", "charges_series",
  // Compléments
  "complements", "complements_pris",
  // Planning des repas
  "planning_repas",
  // Fin de suivi
  "demandes_suite", "avis",
  // Formules, paiements, revenus
  "paiements_clientes", "echeances_paiement", "revenus_divers",
  // Messages, annonces, rappels
  "messages_cliente", "annonces", "rappels_envoyes", "taches_du_matin",
  // Communauté
  "membres_communaute", "messages_communaute", "reactions_communaute", "signalements_communaute",
  // Défis du mois
  "defis", "defis_participations",
] as const;

/** Exclusions volontaires (et pourquoi). */
export const EXCLUSIONS: Record<string, string> = {
  // Listes de courses : privées, la coach n'y a pas accès (RLS) et elles n'ont pas de valeur de suivi.
  courses: "listes de courses privées des clientes",
  // Métabolisme des abonnées : privé, la coach n'y a pas accès (RLS, 0046) ; l'abonnée le refait en un instant.
  metabolisme: "métabolisme privé des abonnées",
  // Adresses techniques des téléphones et ordinateurs abonnés aux notifications : inutiles hors de l'appareil, et sensibles.
  abonnements_push: "abonnements aux notifications des clientes",
  abonnements_coach: "abonnements aux notifications de la coach",
};

/** Noms des tables créées par un fichier SQL (« create table [if not exists] [public.]nom »). */
export function tablesCreees(sql: string): string[] {
  const sansCommentaires = sql.replace(/--.*$/gm, "");
  return [...sansCommentaires.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi)].map((m) => m[1].toLowerCase());
}
