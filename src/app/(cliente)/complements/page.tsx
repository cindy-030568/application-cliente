import type { Metadata } from "next";
import Link from "next/link";
import { IconeRetour } from "@/components/icones";
import { exigerCliente } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";
import { parMoment, type Complement } from "@/lib/complements";
import { ListeComplements, RappelComplements } from "./liste";

export const metadata: Metadata = { title: "Mes compléments" };

export default async function PageComplements() {
  const { supabase, profil } = await exigerCliente();
  const auj = aujourdhuiParis();
  const [{ data: complements }, { data: pris }, { data: rappel, error: sansRappel }, { count: appareils }] = await Promise.all([
    supabase.from("complements").select("id, nom, moment, quantite, note, ordre, actif").eq("actif", true).order("ordre").returns<Complement[]>(),
    supabase.from("complements_pris").select("complement_id").eq("jour", auj),
    supabase.from("clientes").select("rappel_complements_heure").eq("id", profil.id).maybeSingle<{ rappel_complements_heure: string | null }>(),
    supabase.from("abonnements_push").select("id", { count: "exact", head: true }).eq("cliente_id", profil.id),
  ]);
  const liste = complements ?? [];
  return (
    <div className="pt-encoche flex flex-col gap-5 px-5 pb-6">
      <Link href="/" className="inline-flex items-center gap-1 text-[15px] text-texte-2">
        <IconeRetour className="size-5" /> Accueil
      </Link>
      <div>
        <h1 className="font-titre text-[30px] font-bold leading-tight">Mes compléments</h1>
        <p className="text-[15px] text-texte-2">Ce que je t’ai conseillé : coche au fur et à mesure de la journée.</p>
      </div>
      {liste.length ? (
        <>
          <ListeComplements
            groupes={parMoment(liste).map((g) => ({ ...g, complements: g.complements.map(({ id, nom, quantite, note }) => ({ id, nom, quantite, note })) }))}
            pris={(pris ?? []).map((p) => p.complement_id as string)}
          />
          {!sansRappel && <RappelComplements heure={rappel?.rappel_complements_heure ?? null} appareil={(appareils ?? 0) > 0} />}
        </>
      ) : (
        <p className="rounded-carte bg-blanc-casse p-5 text-[15px] text-texte-2 shadow-douce">Je ne t’ai pas encore conseillé de compléments.</p>
      )}
    </div>
  );
}
