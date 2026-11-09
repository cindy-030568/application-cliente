import type { Metadata } from "next";
import Link from "next/link";
import { IconeRetour } from "@/components/icones";
import { Carte, Surtitre } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { creerCliente } from "../actions";
import { FormulaireInfos } from "../formulaire-infos";

export const metadata: Metadata = { title: "Nouvelle cliente" };

export default async function PageNouvelleCliente() {
  await exigerCoach();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link href="/coach/clientes" className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Clientes
      </Link>
      <div>
        <Surtitre>Nouvelle cliente</Surtitre>
        <h1 className="font-titre text-[34px] font-bold leading-tight">Bienvenue à elle ✨</h1>
      </div>
      <Carte>
        <FormulaireInfos action={creerCliente} creation />
      </Carte>
    </div>
  );
}
