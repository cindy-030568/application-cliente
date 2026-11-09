export type Role = "coach" | "cliente";
export type StatutCliente = "active" | "terminee" | "fermee";

export type Profil = {
  id: string;
  role: Role;
  prenom: string;
  nom: string;
  email: string;
};

export type FicheCliente = {
  id: string;
  statut: StatutCliente;
  date_debut: string | null;
  date_fin: string | null;
  acces_formation: boolean;
  masquer_graph_poids: boolean;
  frequence_bilan_jours: number;
  ferme_le: string | null;
  created_at: string;
};

export type Reglages = {
  version_consentement: string;
  lien_politique: string | null;
  lien_formation: string | null;
  message_formation: string;
  lien_contact: string | null;
  tolerance_pct: number;
  tolerance_g: number;
  hors_tolerance: "masquer" | "badge";
};

export const LIBELLES_STATUT: Record<StatutCliente, string> = {
  active: "Active",
  terminee: "Suivi terminé",
  fermee: "Accès fermé",
};

export type TypePlan = "nutrition" | "sport";
export type SourcePlan = "pdf" | "drive" | "nutrium";

export type Plan = {
  id: string;
  cliente_id: string;
  type: TypePlan;
  source: SourcePlan;
  titre: string;
  fichier_path: string | null;
  url: string | null;
  actif: boolean;
  vu_le: string | null;
  created_at: string;
};

export const COLONNES_PLAN =
  "id, cliente_id, type, source, titre, fichier_path, url, actif, vu_le, created_at";

export const LIBELLES_TYPE_PLAN: Record<TypePlan, string> = {
  nutrition: "Plan alimentaire",
  sport: "Programme sportif",
};

export const LIBELLES_SOURCE_PLAN: Record<SourcePlan, string> = {
  pdf: "PDF dans l’app",
  drive: "Lien Google Drive",
  nutrium: "Lien Nutrium",
};

export const TAILLE_MAX_PDF = 25 * 1024 * 1024;

export type CategorieRessource = { id: string; nom: string; ordre: number };

export type Ressource = {
  id: string;
  titre: string;
  categorie_id: string | null;
  description: string | null;
  url: string;
  visibilite: "toutes" | "certaines";
  created_at: string;
};

export const COLONNES_RESSOURCE = "id, titre, categorie_id, description, url, visibilite, created_at";
