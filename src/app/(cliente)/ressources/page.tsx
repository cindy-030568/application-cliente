import type { Metadata } from "next";
import { ListeRessources, type ParamsRessources } from "@/components/ressources/liste";
import { exigerCliente } from "@/lib/auth";

export const metadata: Metadata = { title: "Ressources" };

export default async function PageRessources({ searchParams }: { searchParams: Promise<ParamsRessources> }) {
  const { supabase, profil } = await exigerCliente();
  return <ListeRessources supabase={supabase} profilId={profil.id} params={await searchParams} base="/ressources" />;
}
