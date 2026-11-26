import type { Metadata } from "next";
import { DetailRessource } from "@/components/ressources/detail";
import { exigerAbonnee } from "@/lib/auth";

export const metadata: Metadata = { title: "Ressource" };

export default async function RessourceAbonnee({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, profil } = await exigerAbonnee();
  return <DetailRessource supabase={supabase} profilId={profil.id} id={(await params).id} base="/espace/ressources" />;
}
