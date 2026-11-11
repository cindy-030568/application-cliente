import "server-only";
import { exigerCoach } from "@/lib/auth";
import { COLONNES_FICHE, type FicheCliente, type Profil } from "@/lib/types";

export type ClienteListe = FicheCliente & { profils: Pick<Profil, "prenom" | "nom" | "email"> };

export async function listerClientes() {
  const { supabase } = await exigerCoach();
  const { data, error } = await supabase
    .from("clientes")
    .select(
      `${COLONNES_FICHE}, profils!inner(prenom, nom, email)`,
    )
    .order("created_at", { ascending: false })
    .returns<ClienteListe[]>();
  if (error) throw new Error("Impossible de charger les clientes");
  return data ?? [];
}
