import type { Metadata } from "next";
import Link from "next/link";
import { IconePlus } from "@/components/icones";
import { Carte, Etiquette, LienBouton, Message, Surtitre } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { chargerFiltres, chargerVideos } from "@/lib/videos";
import { urlMiniature } from "@/lib/youtube";
import { GestionFiltres } from "./filtres";

export const metadata: Metadata = { title: "Vidéos" };

export default async function PageVideosCoach({
  searchParams,
}: {
  searchParams: Promise<{ ajoutee?: string; supprimee?: string }>;
}) {
  const { ajoutee, supprimee } = await searchParams;
  const { supabase } = await exigerCoach();
  const [filtres, videos] = await Promise.all([chargerFiltres(supabase), chargerVideos(supabase)]);
  const nomFiltre = new Map(filtres.map((f) => [f.id, f.nom]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Surtitre>Vidéos</Surtitre>
          <h1 className="font-titre text-[34px] font-bold leading-tight">Vidéos d’exercices</h1>
          <p className="mt-1 text-[15px] text-texte-2">
            {videos.length} exercice{videos.length > 1 ? "s" : ""} · hébergés sur YouTube en « non répertorié »
          </p>
        </div>
        <LienBouton href="/coach/videos/nouvelle">
          <IconePlus className="size-5" /> Nouvelle vidéo
        </LienBouton>
      </div>
      {ajoutee && <Message ton="succes">Vidéo ajoutée à la bibliothèque.</Message>}
      {supprimee && <Message ton="succes">Vidéo supprimée.</Message>}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        {videos.length === 0 ? (
          <Carte className="text-center text-texte-2">
            Ta bibliothèque est vide. Ajoute ta première vidéo avec le bouton « Nouvelle vidéo ».
          </Carte>
        ) : (
          <Carte className="h-fit overflow-hidden p-0">
            <ul className="divide-y divide-ligne">
              {videos.map((v) => (
                <li key={v.id}>
                  <Link href={`/coach/videos/${v.id}`} className="flex items-center gap-4 p-3 hover:bg-sable/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={urlMiniature(v.youtube_id, "mq")}
                      alt=""
                      loading="lazy"
                      className="aspect-video w-28 shrink-0 rounded-lg object-cover"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate font-medium">{v.titre}</span>
                      <span className="truncate text-[13px] text-texte-2">
                        {v.filtres.map((f) => nomFiltre.get(f)).filter(Boolean).join(" · ") || "Aucun filtre"}
                      </span>
                    </span>
                    {!v.publiee && <Etiquette ton="sable">Brouillon</Etiquette>}
                  </Link>
                </li>
              ))}
            </ul>
          </Carte>
        )}
        <Carte className="flex h-fit flex-col gap-4">
          <h2 className="font-titre text-lg font-bold">Filtres</h2>
          <GestionFiltres filtres={filtres} />
        </Carte>
      </div>
    </div>
  );
}
