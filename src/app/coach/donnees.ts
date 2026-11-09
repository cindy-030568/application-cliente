import "server-only";
import { exigerCoach } from "@/lib/auth";
import type { FicheCliente, Profil } from "@/lib/types";

export type ClienteListe = FicheCliente & { profils: Pick<Profil, "prenom" | "nom" | "email"> };

export async function listerClientes() {
  const { supabase } = await exigerCoach();
  const { data, error } = await supabase
    .from("clientes")
    .select(
      "id, statut, date_debut, date_fin, acces_formation, masquer_graph_poids, frequence_bilan_jours, ferme_le, created_at, profils!inner(prenom, nom, email)",
    )
    .order("created_at", { ascending: false })
    .returns<ClienteListe[]>();
  if (error) throw new Error("Impossible de charger les clientes");
  return data ?? [];
}
