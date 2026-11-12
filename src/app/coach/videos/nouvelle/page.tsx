import type { Metadata } from "next";
import Link from "next/link";
import { IconeRetour } from "@/components/icones";
import { Carte, Surtitre } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { chargerFiltres } from "@/lib/videos";
import { FormulaireVideo } from "../formulaire";

export const metadata: Metadata = { title: "Nouvelle vidéo" };

export default async function PageNouvelleVideo() {
  const { supabase } = await exigerCoach();
  const filtres = await chargerFiltres(supabase);
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Link href="/coach/videos" className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Vidéos
      </Link>
      <div>
        <Surtitre>Nouvelle vidéo</Surtitre>
        <h1 className="font-titre text-[32px] font-bold leading-tight">Ajouter un exercice</h1>
      </div>
      <Carte>
        <FormulaireVideo filtres={filtres} />
      </Carte>
    </div>
  );
}
