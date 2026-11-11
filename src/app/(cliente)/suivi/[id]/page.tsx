import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeRetour } from "@/components/icones";
import { LienBouton, Message } from "@/components/ui";
import { DetailBilan } from "@/components/suivi/detail-bilan";
import { BoutonSupprimerBilan } from "@/components/suivi/supprimer-bilan";
import { exigerCliente } from "@/lib/auth";
import { formaterDate } from "@/lib/bilan";
import { chargerBilan, chargerChamps, champsVisibles, urlsPhotos } from "@/lib/suivi";
import { MarquerRetourLu } from "./marquer-lu";

export const metadata: Metadata = { title: "Mon bilan" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageBilanCliente({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ envoye?: string }>;
}) {
  const { id } = await params;
  const { envoye } = await searchParams;
  if (!UUID.test(id)) notFound();
  const { supabase, fiche } = await exigerCliente();
  const bilan = await chargerBilan(supabase, id);
  if (!bilan) notFound();
  const champs = champsVisibles(await chargerChamps(supabase, true), fiche.mode_sans_chiffres);
  const urls = await urlsPhotos(supabase, bilan.photos.map((p) => p.fichier_path));

  return (
    <div className="pt-encoche flex flex-col gap-6 px-5">
      {bilan.retour && !bilan.retour.lu_le && <MarquerRetourLu bilanId={bilan.id} />}
      <Link href="/suivi" className="inline-flex items-center gap-1 text-[15px] text-texte-2">
        <IconeRetour className="size-5" /> Mon suivi
      </Link>
      <div>
        <h1 className="font-titre text-[30px] font-bold leading-tight">
          {bilan.echeance ? "Mon bilan" : "Ma mesure"} du {formaterDate(bilan.date_mesure, { year: undefined })}
        </h1>
        {bilan.modifie_le && <p className="text-[13px] text-texte-2">Modifié après envoi</p>}
      </div>

      {envoye && (
        <Message ton="succes">
          {bilan.echeance ? "Bilan envoyé à Cindy. Bravo d’avoir pris ce temps pour toi 💛" : "C’est noté !"}
        </Message>
      )}

      {bilan.retour && (
        <section className="flex flex-col gap-2 rounded-bloc bg-chocolat p-5 text-creme">
          <p className="font-main text-[24px] leading-none text-caramel-clair">Le mot de Cindy</p>
          <p className="whitespace-pre-wrap text-[15.5px] leading-relaxed">{bilan.retour.contenu}</p>
        </section>
      )}

      <DetailBilan bilan={bilan} champs={champs} urls={urls} />

      <div className="flex flex-col gap-4 pb-4">
        <LienBouton href={`/suivi/${bilan.id}/modifier`} variante="contour" pleineLargeur>
          Modifier
        </LienBouton>
        <BoutonSupprimerBilan bilanId={bilan.id} retour="/suivi" />
      </div>
    </div>
  );
}
