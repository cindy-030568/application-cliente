import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fiche } from "@/components/fiche";
import { IconeRetour } from "@/components/icones";
import { exigerCliente } from "@/lib/auth";

export const metadata: Metadata = { title: "Fiche pratique" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageFiche({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await exigerCliente();
  // La RLS ne renvoie que les fiches publiées, pour toutes ou choisies pour elle.
  const { data: r } = await supabase
    .from("ressources")
    .select("titre, description, contenu")
    .eq("id", id)
    .maybeSingle<{ titre: string; description: string | null; contenu: string | null }>();
  if (!r?.contenu) notFound();
  return (
    <article className="pt-encoche flex flex-col gap-4 px-5 pb-8">
      <Link href="/ressources" className="inline-flex items-center gap-1 text-[15px] text-texte-2">
        <IconeRetour className="size-5" /> Mes ressources
      </Link>
      <h1 className="font-titre text-[30px] font-bold leading-tight">{r.titre}</h1>
      {r.description && <p className="text-[16px] text-texte-2">{r.description}</p>}
      <Fiche contenu={r.contenu} />
    </article>
  );
}
