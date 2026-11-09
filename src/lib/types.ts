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
