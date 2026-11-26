import type { Metadata } from "next";
import { ListeRessources, type ParamsRessources } from "@/components/ressources/liste";
import { exigerAbonnee } from "@/lib/auth";

export const metadata: Metadata = { title: "Ressources" };

/** Les ressources cochées « pour les abonnées » (la RLS ne renvoie que celles-là). */
export default async function RessourcesAbonnee({ searchParams }: { searchParams: Promise<ParamsRessources> }) {
  const { supabase, profil } = await exigerAbonnee();
  return <ListeRessources supabase={supabase} profilId={profil.id} params={await searchParams} base="/espace/ressources" lienProfil="/espace/profil" />;
}
