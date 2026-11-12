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
  mode_sans_chiffres: boolean;
  prochain_rdv: string | null;
  lien_rdv: string | null;
  derniere_visite: string | null;
};

export const COLONNES_FICHE =
  "id, statut, date_debut, date_fin, acces_formation, masquer_graph_poids, frequence_bilan_jours, ferme_le, created_at, mode_sans_chiffres, prochain_rdv, lien_rdv, derniere_visite";

export type Reglages = {
  version_consentement: string;
  lien_politique: string | null;
  lien_formation: string | null;
  message_formation: string;
  lien_contact: string | null;
  tolerance_pct: number;
  tolerance_g: number;
  hors_tolerance: "masquer" | "badge";
  fenetre_bilan_jours: number;
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

export type GroupeChamp = "mesure" | "ressenti";
export type TypeChamp = "nombre" | "echelle" | "choix";

export type ChampMesure = {
  id: string;
  groupe: GroupeChamp;
  type: TypeChamp;
  libelle: string;
  unite: string | null;
  aide: string | null;
  options: string[] | null;
  ordre: number;
  actif: boolean;
  est_poids: boolean;
};

export const COLONNES_CHAMP = "id, groupe, type, libelle, unite, aide, options, ordre, actif, est_poids";

export type AnglePhoto = "face" | "profil" | "dos";
export const ANGLES: { valeur: AnglePhoto; libelle: string }[] = [
  { valeur: "face", libelle: "Face" },
  { valeur: "profil", libelle: "Profil" },
  { valeur: "dos", libelle: "Dos" },
];

export type ValeurBilan = { champ_id: string; valeur_num: number | null; valeur_texte: string | null };
export type PhotoBilan = { id: string; angle: AnglePhoto; fichier_path: string };
export type RetourBilan = { contenu: string; created_at: string; updated_at: string; lu_le: string | null };

export type Bilan = {
  id: string;
  cliente_id: string;
  date_mesure: string;
  echeance: string | null;
  commentaire: string | null;
  saisi_par: string | null;
  envoye_le: string;
  modifie_le: string | null;
  valeurs: ValeurBilan[];
  photos: PhotoBilan[];
  retour: RetourBilan | null;
};

export const SELECTION_BILAN =
  "id, cliente_id, date_mesure, echeance, commentaire, saisi_par, envoye_le, modifie_le, bilan_valeurs(champ_id, valeur_num, valeur_texte), photos_bilan(id, angle, fichier_path), retours_bilan(contenu, created_at, updated_at, lu_le)";

type BilanBrut = Omit<Bilan, "valeurs" | "photos" | "retour"> & {
  bilan_valeurs: ValeurBilan[] | null;
  photos_bilan: PhotoBilan[] | null;
  retours_bilan: RetourBilan | RetourBilan[] | null;
};

/** Met en forme un bilan lu avec SELECTION_BILAN. */
export function normaliserBilan(b: BilanBrut): Bilan {
  const { bilan_valeurs, photos_bilan, retours_bilan, ...reste } = b;
  const retour = Array.isArray(retours_bilan) ? (retours_bilan[0] ?? null) : retours_bilan;
  return {
    ...reste,
    valeurs: (bilan_valeurs ?? []).map((v) => ({ ...v, valeur_num: v.valeur_num === null ? null : Number(v.valeur_num) })),
    photos: photos_bilan ?? [],
    retour,
  };
}
export type { BilanBrut };

export type FamilleFiltre = "groupe" | "materiel" | "categorie";
export const FAMILLES: { valeur: FamilleFiltre; libelle: string; param: string }[] = [
  { valeur: "groupe", libelle: "Groupe musculaire", param: "groupe" },
  { valeur: "materiel", libelle: "Matériel", param: "materiel" },
  { valeur: "categorie", libelle: "Catégorie", param: "categorie" },
];
export type FiltreVideo = { id: string; famille: FamilleFiltre; nom: string; ordre: number };

export type Video = {
  id: string;
  titre: string;
  youtube_id: string;
  description: string | null;
  points_cles: string[];
  erreurs: string[];
  publiee: boolean;
  created_at: string;
  filtres: string[];
};
export const SELECTION_VIDEO =
  "id, titre, youtube_id, description, points_cles, erreurs, publiee, created_at, videos_filtres(filtre_id)";
export type VideoBrute = Omit<Video, "filtres"> & { videos_filtres: { filtre_id: string }[] | null };
export function normaliserVideo(v: VideoBrute): Video {
  const { videos_filtres, ...reste } = v;
  return { ...reste, filtres: (videos_filtres ?? []).map((f) => f.filtre_id) };
}
