import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fiche } from "@/components/fiche";
import { IconeRetour } from "@/components/icones";
import { Carte, Etiquette } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";

export const metadata: Metadata = { title: "Aperçu de la fiche" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Aperçu d'une fiche telle que tes clientes la liront. */
export default async function ApercuFiche({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await exigerCoach();
  const { data: r } = await supabase
    .from("ressources")
    .select("titre, description, contenu, publiee")
    .eq("id", id)
    .maybeSingle<{ titre: string; description: string | null; contenu: string | null; publiee: boolean }>();
  if (!r?.contenu) notFound();
  return (
    <div className="flex flex-col gap-5">
      <Link href="/coach/ressources" className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Mes ressources
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-titre text-[32px] font-bold leading-tight">{r.titre}</h1>
        {r.publiee ? <Etiquette ton="vert">Publiée</Etiquette> : <Etiquette ton="rose">Brouillon : invisible pour tes clientes</Etiquette>}
      </div>
      <p className="text-[14px] text-texte-2">Aperçu tel que tes clientes la liront. Pour la modifier ou la publier : Mes ressources → Modifier.</p>
      <Carte className="max-w-2xl">
        {r.description && <p className="mb-4 text-[15px] italic text-texte-2">{r.description}</p>}
        <Fiche contenu={r.contenu} />
      </Carte>
    </div>
  );
}
