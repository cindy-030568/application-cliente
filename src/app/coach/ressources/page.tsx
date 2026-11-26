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

  // Fiches écrites dans l'appli et brouillons (0037) : lus à part, rien avant la mise à jour.
  const { data: fiches, error: sansFiches } = await supabase
    .from("ressources")
    .select("id, contenu, publiee")
    .returns<{ id: string; contenu: string | null; publiee: boolean }[]>();
  const fiche = new Map((fiches ?? []).map((f) => [f.id, f]));
  // Audios (0043) : lus à part, rien avant la mise à jour.
  const { data: audios, error: sansAudio } = await supabase
    .from("ressources")
    .select("id, audio_path, audio_duree")
    .returns<{ id: string; audio_path: string | null; audio_duree: number | null }[]>();
  const audio = new Map((audios ?? []).map((a) => [a.id, a]));
  // « Aussi pour les abonnées » (0046) : lu à part, rien avant la mise à jour.
  const { data: abonnees, error: sansAbonnees } = await supabase
    .from("ressources")
    .select("id, pour_abonnees")
    .returns<{ id: string; pour_abonnees: boolean }[]>();
  const pourAbonnees = new Set((abonnees ?? []).filter((a) => a.pour_abonnees).map((a) => a.id));
  const avecClientes = (ressources ?? []).map((r) => ({
    ...r,
    contenu: fiche.get(r.id)?.contenu ?? null,
    publiee: fiche.get(r.id)?.publiee ?? true,
    audio_path: audio.get(r.id)?.audio_path ?? null,
    audio_duree: audio.get(r.id)?.audio_duree ?? null,
    pour_abonnees: pourAbonnees.has(r.id),
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
          Guides, listes de courses, fiches, audios… hébergés sur ton Google Drive, écrits ou enregistrés directement ici. Tes clientes les
          retrouvent dans leur espace, rangés par catégorie. Un brouillon reste invisible pour elles tant que tu ne l’as pas publié.
        </p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <GestionRessources categories={categories ?? []} ressources={avecClientes} clientes={choix} avecFiches={!sansFiches} avecAudio={!sansAudio} avecAbonnees={!sansAbonnees} />
        <Carte className="flex h-fit flex-col gap-4">
          <h2 className="font-titre text-lg font-bold">Catégories</h2>
          <GestionCategories categories={categories ?? []} />
        </Carte>
      </div>
    </div>
  );
}
