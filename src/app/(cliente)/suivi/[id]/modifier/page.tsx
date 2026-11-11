import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeRetour } from "@/components/icones";
import { FormulaireBilan } from "@/components/suivi/formulaire-bilan";
import { exigerCliente } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";
import { chargerBilan, chargerChamps, champsVisibles, urlsPhotos } from "@/lib/suivi";
import type { AnglePhoto } from "@/lib/types";

export const metadata: Metadata = { title: "Modifier mon bilan" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageModifierBilan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, fiche } = await exigerCliente();
  const bilan = await chargerBilan(supabase, id);
  if (!bilan) notFound();
  const champs = champsVisibles(await chargerChamps(supabase), fiche.mode_sans_chiffres);
  const urls = await urlsPhotos(supabase, bilan.photos.map((p) => p.fichier_path));

  const valeurs: Record<string, string> = {};
  for (const v of bilan.valeurs) {
    valeurs[v.champ_id] = v.valeur_texte ?? (v.valeur_num !== null ? String(v.valeur_num).replace(".", ",") : "");
  }
  const photos: Partial<Record<AnglePhoto, string>> = {};
  for (const p of bilan.photos) {
    const url = urls.get(p.fichier_path);
    if (url) photos[p.angle] = url;
  }

  return (
    <div className="pt-encoche flex flex-col gap-6 px-5">
      <Link href={`/suivi/${bilan.id}`} className="inline-flex items-center gap-1 text-[15px] text-texte-2">
        <IconeRetour className="size-5" /> Retour
      </Link>
      <h1 className="font-titre text-[30px] font-bold leading-tight">Modifier</h1>
      <FormulaireBilan
        champs={champs}
        valeursInitiales={valeurs}
        photosInitiales={photos}
        bilanId={bilan.id}
        dateInitiale={bilan.date_mesure}
        dateMax={aujourdhuiParis()}
        commentaireInitial={bilan.commentaire ?? ""}
        sansPhotos={fiche.mode_sans_chiffres}
        redirection="/suivi/{id}"
        libelleEnvoi="Enregistrer les modifications"
      />
    </div>
  );
}
