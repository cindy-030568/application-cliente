import type { Metadata } from "next";
import { Carte, Surtitre } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { COLONNES_RESSOURCE, type CategorieRessource, type Ressource } from "@/lib/types";
import { GestionCategories, GestionRessources } from "./gestion";

export const metadata: Metadata = { title: "Ressources" };

export default async function PageRessourcesCoach() {
  const { supabase } = await exigerCoach();
  const [{ data: categories }, { data: ressources }, { data: liens }, { data: clientes }] =
    await Promise.all([
      supabase.from("categories_ressource").select("id, nom, ordre").order("ordre").returns<CategorieRessource[]>(),
      supabase.from("ressources").select(COLONNES_RESSOURCE).order("created_at", { ascending: false }).returns<Ressource[]>(),
      supabase.from("ressources_clientes").select("ressource_id, cliente_id"),
      supabase
        .from("clientes")
        .select("id, statut, profils!inner(prenom, nom)")
        .neq("statut", "fermee")
        .returns<{ id: string; statut: string; profils: { prenom: string; nom: string } }[]>(),
    ]);

  const avecClientes = (ressources ?? []).map((r) => ({
    ...r,
    clientes: (liens ?? []).filter((l) => l.ressource_id === r.id).map((l) => l.cliente_id as string),
  }));
  const choix = (clientes ?? [])
    .map((c) => ({ id: c.id, nom: `${c.profils.prenom} ${c.profils.nom}`.trim() }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Surtitre>Ressources</Surtitre>
        <h1 className="font-titre text-[34px] font-bold leading-tight">Mes ressources</h1>
        <p className="mt-1 max-w-2xl text-[15px] text-texte-2">
          Guides, listes de courses, fiches… hébergés sur ton Google Drive. Tes clientes les
          retrouvent dans leur espace, rangés par catégorie.
        </p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <GestionRessources categories={categories ?? []} ressources={avecClientes} clientes={choix} />
        <Carte className="flex h-fit flex-col gap-4">
          <h2 className="font-titre text-lg font-bold">Catégories</h2>
          <GestionCategories categories={categories ?? []} />
        </Carte>
      </div>
    </div>
  );
}
