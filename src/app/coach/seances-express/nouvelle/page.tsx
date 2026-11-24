import type { Metadata } from "next";
import Link from "next/link";
import { IconeRetour } from "@/components/icones";
import { Carte, Surtitre } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { lireListesExpress } from "@/lib/seances-express-serveur";
import { FormulaireSeanceExpress } from "../formulaire";
import { clientesAChoisir } from "../clientes";

export const metadata: Metadata = { title: "Nouvelle séance express" };

export default async function NouvelleSeanceExpress() {
  const { supabase } = await exigerCoach();
  const [listes, clientes] = await Promise.all([lireListesExpress(supabase), clientesAChoisir(supabase)]);
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link href="/coach/seances-express" className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Séances express
      </Link>
      <div>
        <Surtitre>Séances express</Surtitre>
        <h1 className="font-titre text-[32px] font-bold leading-tight">Nouvelle séance</h1>
      </div>
      <Carte>
        <FormulaireSeanceExpress listes={listes} clientes={clientes} />
      </Carte>
    </div>
  );
}
