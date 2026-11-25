import type { Metadata } from "next";
import Link from "next/link";
import { IconeRetour } from "@/components/icones";
import { Carte, Surtitre } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";
import { periodeParDefaut } from "@/lib/defis";
import { lireEtatCommunaute } from "@/lib/communaute-serveur";
import { FormulaireDefi } from "../formulaire";

export const metadata: Metadata = { title: "Nouveau défi" };

export default async function NouveauDefi() {
  const { supabase } = await exigerCoach();
  const communaute = await lireEtatCommunaute(supabase);
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link href="/coach/defis" className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Défis du mois
      </Link>
      <div>
        <Surtitre>Défis du mois</Surtitre>
        <h1 className="font-titre text-[32px] font-bold leading-tight">Nouveau défi</h1>
      </div>
      <Carte>
        <FormulaireDefi periode={periodeParDefaut(aujourdhuiParis())} communauteOuverte={Boolean(communaute?.ouverte)} />
      </Carte>
    </div>
  );
}
