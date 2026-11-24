import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VueBilanFin } from "@/components/bilan-fin";
import { IconeRetour } from "@/components/icones";
import { Message } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";
import { bilanFinVisible } from "@/lib/bilan-fin";
import { chargerBilanFin } from "@/lib/bilan-fin-serveur";
import { urlsPhotos } from "@/lib/suivi";
import { COLONNES_FICHE, type FicheCliente } from "@/lib/types";

export const metadata: Metadata = { title: "Bilan de fin de suivi" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Aperçu du bilan de fin de suivi d'une cliente, tel qu'elle le voit. */
export default async function ApercuBilanFin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await exigerCoach();
  const { data: c } = await supabase
    .from("clientes")
    .select(`${COLONNES_FICHE}, profils!inner(prenom)`)
    .eq("id", id)
    .maybeSingle<FicheCliente & { profils: { prenom: string } }>();
  if (!c) notFound();
  const d = await chargerBilanFin(supabase, { ...c, prenom: c.profils.prenom });
  const urls = d.photos ? await urlsPhotos(supabase, [d.photos.avant.chemin, d.photos.apres.chemin]) : new Map<string, string>();
  const photos = d.photos && urls.get(d.photos.avant.chemin) && urls.get(d.photos.apres.chemin) ? { avant: urls.get(d.photos.avant.chemin)!, apres: urls.get(d.photos.apres.chemin)! } : null;
  const visible = bilanFinVisible(c, aujourdhuiParis());
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <Link href={`/coach/clientes/${id}`} className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Fiche de {c.profils.prenom}
      </Link>
      <Message ton="info">
        {visible
          ? "Aperçu : c’est ce que ta cliente voit en ce moment dans son appli."
          : "Aperçu : ta cliente le verra 7 jours avant sa date de fin, ou dès que tu passes son suivi en « Terminé »."}
      </Message>
      <VueBilanFin
        d={d}
        photos={photos}
        lienPdf={null}
        suite={
          <section className="flex flex-col gap-2 rounded-bloc border border-dashed border-caramel-clair p-5">
            <h2 className="font-titre text-[20px] font-bold">Continuer avec moi</h2>
            <p className="whitespace-pre-line text-[15px]">{d.texte}</p>
            <ul className="list-disc pl-5 text-[14.5px]">
              {d.offres.map((o) => (
                <li key={o.titre}>{o.titre}</li>
              ))}
            </ul>
            <Link href="/coach/reglages#fin-de-suivi" className="text-[14px] underline underline-offset-4">
              Modifier ce texte et tes offres
            </Link>
          </section>
        }
      />
    </div>
  );
}
