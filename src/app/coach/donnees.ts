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
  return trierClientes(data ?? []);
}

/** Ordre alphabétique (prénom puis nom), sans tenir compte des accents ni des majuscules. */
export function trierClientes<T extends { profils: { prenom: string; nom: string } }>(liste: T[]): T[] {
  const ordre = new Intl.Collator("fr", { sensitivity: "base" });
  return [...liste].sort(
    (a, b) => ordre.compare(a.profils.prenom.trim(), b.profils.prenom.trim()) || ordre.compare(a.profils.nom.trim(), b.profils.nom.trim()),
  );
}
