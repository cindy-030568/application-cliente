import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeRetour } from "@/components/icones";
import { Carte, Surtitre } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { chargerFiltres, chargerVideo } from "@/lib/videos";
import { FormulaireVideo } from "../formulaire";

export const metadata: Metadata = { title: "Modifier la vidéo" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageModifierVideo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await exigerCoach();
  const [video, filtres] = await Promise.all([chargerVideo(supabase, id), chargerFiltres(supabase)]);
  if (!video) notFound();
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Link href="/coach/videos" className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Vidéos
      </Link>
      <div>
        <Surtitre>Modifier</Surtitre>
        <h1 className="font-titre text-[32px] font-bold leading-tight">{video.titre}</h1>
      </div>
      <Carte>
        <FormulaireVideo key={video.id} filtres={filtres} video={video} />
      </Carte>
    </div>
  );
}
