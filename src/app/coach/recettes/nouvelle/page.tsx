import type { Metadata } from "next";
import Link from "next/link";
import { IconeRetour } from "@/components/icones";
import { Carte, Surtitre } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { chargerTags } from "@/lib/recettes";
import { EditeurRecette } from "../editeur";

export const metadata: Metadata = { title: "Nouvelle recette" };

export default async function PageNouvelleRecette() {
  const { supabase } = await exigerCoach();
  const tags = await chargerTags(supabase);
  return (
    <div className="flex flex-col gap-6">
      <Link href="/coach/recettes" className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Recettes
      </Link>
      <div>
        <Surtitre>Nouvelle recette</Surtitre>
        <h1 className="font-titre text-[32px] font-bold leading-tight">Créer une recette maître</h1>
      </div>
      <Carte>
        <EditeurRecette tags={tags} urlPhoto={null} />
      </Carte>
    </div>
  );
}
