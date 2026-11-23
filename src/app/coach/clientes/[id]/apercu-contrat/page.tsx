import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeRetour } from "@/components/icones";
import { Carte, Message } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";

export const metadata: Metadata = { title: "Aperçu du contrat" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Le contrat tel que cette cliente le lira (variables remplies avec sa fiche). */
export default async function PageApercuContrat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await exigerCoach();
  const [{ data: p }, { data: texte, error }] = await Promise.all([
    supabase.from("profils").select("prenom").eq("id", id).maybeSingle<{ prenom: string }>(),
    supabase.rpc("apercu_contrat", { p_cliente: id }),
  ]);
  if (!p) notFound();
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href={`/coach/clientes/${id}`} className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Fiche de {p.prenom}
      </Link>
      <div>
        <h1 className="font-titre text-[32px] font-bold leading-tight">Son contrat, tel qu’elle le lira</h1>
        <p className="text-[15px] text-texte-2">
          Les informations entre crochets (adresse, date de naissance) seront tapées par {p.prenom} sur l’écran du contrat. Un « — » signale une
          information manquante dans sa fiche (formule, montant, paiement…).
        </p>
      </div>
      {error || typeof texte !== "string" || !texte ? (
        <Message ton="info">Pas de contrat dans Réglages → Mon contrat (ou mise à jour 0029 pas encore faite).</Message>
      ) : (
        <Carte className="whitespace-pre-wrap text-[14.5px] leading-relaxed">{texte}</Carte>
      )}
    </div>
  );
}
