import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeRetour } from "@/components/icones";
import { Carte, Surtitre } from "@/components/ui";
import { chargerAliment, chargerCategoriesAliment } from "@/lib/aliments";
import { exigerCoach } from "@/lib/auth";
import { FormulaireAliment } from "../formulaire";

export const metadata: Metadata = { title: "Aliment" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageAliment({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await exigerCoach();
  const [aliment, categories] = await Promise.all([chargerAliment(supabase, id), chargerCategoriesAliment(supabase)]);
  if (!aliment) notFound();
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/coach/aliments" className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Aliments
      </Link>
      <div>
        <Surtitre>{aliment.source === "ciqual" ? "Aliment Ciqual" : "Aliment perso"}</Surtitre>
        <h1 className="font-titre text-[30px] font-bold leading-tight">{aliment.nom}</h1>
      </div>
      <Carte>
        <FormulaireAliment key={aliment.id} aliment={aliment} categories={categories} />
      </Carte>
    </div>
  );
}
