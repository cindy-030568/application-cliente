import type { Metadata } from "next";
import Link from "next/link";
import { IconeRetour } from "@/components/icones";
import { EspaceCommunaute, salonDepuis } from "@/components/communaute/espace-communaute";
import { exigerCliente } from "@/lib/auth";

export const metadata: Metadata = { title: "Communauté" };

export default async function PageCommunaute({ searchParams }: { searchParams: Promise<{ salon?: string }> }) {
  const [{ supabase, profil, reglages }, { salon }] = await Promise.all([exigerCliente(), searchParams]);
  return (
    <div className="pt-encoche flex flex-col gap-5 px-5 pb-6">
      <Link href="/" className="inline-flex items-center gap-1 text-[15px] text-texte-2">
        <IconeRetour className="size-5" /> Accueil
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="font-titre text-[30px] font-bold leading-tight">La communauté</h1>
        <p className="font-main text-[22px] leading-tight text-caramel-texte">Entre clientes, on se motive 💛</p>
      </div>
      <EspaceCommunaute supabase={supabase} moi={profil.id} lienPolitique={reglages.lien_politique} salon={salonDepuis(salon)} base="/communaute" />
    </div>
  );
}
