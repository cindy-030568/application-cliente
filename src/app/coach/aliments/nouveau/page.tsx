import type { Metadata } from "next";
import Link from "next/link";
import { IconeRetour } from "@/components/icones";
import { Carte, Surtitre } from "@/components/ui";
import { chargerCategoriesAliment } from "@/lib/aliments";
import { exigerCoach } from "@/lib/auth";
import { FormulaireAliment } from "../formulaire";

export const metadata: Metadata = { title: "Nouvel aliment" };

export default async function PageNouvelAliment() {
  const { supabase } = await exigerCoach();
  const categories = await chargerCategoriesAliment(supabase);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/coach/aliments" className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Aliments
      </Link>
      <div>
        <Surtitre>Nouvel aliment perso</Surtitre>
        <h1 className="font-titre text-[32px] font-bold leading-tight">Ajouter un aliment</h1>
        <p className="text-[15px] text-texte-2">Pour un produit absent de Ciqual (skyr, whey, une marque précise…).</p>
      </div>
      <Carte>
        <FormulaireAliment categories={categories} />
      </Carte>
    </div>
  );
}
