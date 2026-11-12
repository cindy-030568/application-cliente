import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeRetour } from "@/components/icones";
import { Carte, Message, Surtitre } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { chargerRecette, chargerTags, urlPhotoRecette } from "@/lib/recettes";
import { EditeurRecette } from "../editeur";

export const metadata: Metadata = { title: "Recette" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageRecette({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creee?: string }>;
}) {
  const { id } = await params;
  const { creee } = await searchParams;
  if (!UUID.test(id)) notFound();
  const { supabase } = await exigerCoach();
  const [recette, tags] = await Promise.all([chargerRecette(supabase, id), chargerTags(supabase)]);
  if (!recette) notFound();
  return (
    <div className="flex flex-col gap-6">
      <Link href="/coach/recettes" className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Recettes
      </Link>
      <div>
        <Surtitre>Recette maître</Surtitre>
        <h1 className="font-titre text-[32px] font-bold leading-tight">{recette.titre}</h1>
      </div>
      {creee && <Message ton="succes">Recette créée.</Message>}
      <Carte>
        <EditeurRecette key={recette.id} recette={recette} tags={tags} urlPhoto={urlPhotoRecette(recette.photo_path)} />
      </Carte>
    </div>
  );
}
