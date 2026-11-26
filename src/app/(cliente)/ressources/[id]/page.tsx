import type { Metadata } from "next";
import { DetailRessource } from "@/components/ressources/detail";
import { exigerCliente } from "@/lib/auth";

export const metadata: Metadata = { title: "Ressource" };

export default async function PageRessource({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, profil } = await exigerCliente();
  return <DetailRessource supabase={supabase} profilId={profil.id} id={(await params).id} base="/ressources" />;
}
