import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { VueBilanFin } from "@/components/bilan-fin";
import { IconeRetour } from "@/components/icones";
import { exigerCliente } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";
import { bilanFinVisible } from "@/lib/bilan-fin";
import { chargerBilanFin } from "@/lib/bilan-fin-serveur";
import { urlsPhotos } from "@/lib/suivi";
import { BlocSuite } from "./suite";

export const metadata: Metadata = { title: "Mon bilan de fin de suivi" };

export default async function PageBilanFin() {
  const { supabase, profil, fiche } = await exigerCliente();
  if (!bilanFinVisible(fiche, aujourdhuiParis())) redirect("/");
  const d = await chargerBilanFin(supabase, { ...fiche, id: profil.id, prenom: profil.prenom });
  const urls = d.photos ? await urlsPhotos(supabase, [d.photos.avant.chemin, d.photos.apres.chemin]) : new Map<string, string>();
  const photos = d.photos && urls.get(d.photos.avant.chemin) && urls.get(d.photos.apres.chemin) ? { avant: urls.get(d.photos.avant.chemin)!, apres: urls.get(d.photos.apres.chemin)! } : null;
  return (
    <div className="pt-encoche flex flex-col gap-5 px-5 pb-8">
      <Link href="/" className="inline-flex items-center gap-1 text-[15px] text-texte-2">
        <IconeRetour className="size-5" /> Accueil
      </Link>
      <VueBilanFin d={d} photos={photos} lienPdf="/bilan-de-fin/pdf" suite={
          <>
            <Link href="/avis?de=fin" className="flex items-center gap-4 rounded-carte bg-blanc-casse p-4 shadow-douce">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-pale text-xl" aria-hidden>
                💌
              </span>
              <span className="flex flex-1 flex-col">
                <span className="font-medium">Laisser un témoignage</span>
                <span className="text-[14px] text-texte-2">Quelques mots sur ton accompagnement, publiés seulement si tu le souhaites.</span>
              </span>
            </Link>
            <BlocSuite texte={d.texte} offres={d.offres} demandees={d.demandees} />
          </>
        }
      />
    </div>
  );
}
