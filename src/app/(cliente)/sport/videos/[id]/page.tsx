import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeRetour } from "@/components/icones";
import { Etiquette, Surtitre } from "@/components/ui";
import { CarteVideo } from "@/components/video/carte-video";
import { LecteurYoutube } from "@/components/video/lecteur-youtube";
import { exigerCliente } from "@/lib/auth";
import { chargerFiltres, chargerVideo, chargerVideos } from "@/lib/videos";

export const metadata: Metadata = { title: "Exercice" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageExercice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await exigerCliente();
  const [video, filtres, toutes] = await Promise.all([
    chargerVideo(supabase, id),
    chargerFiltres(supabase),
    chargerVideos(supabase),
  ]);
  if (!video) notFound();

  const sesFiltres = filtres.filter((f) => video.filtres.includes(f.id));
  const groupes = sesFiltres.filter((f) => f.famille === "groupe").map((f) => f.id);
  const similaires = toutes
    .filter((v) => v.id !== video.id && v.filtres.some((f) => groupes.includes(f)))
    .slice(0, 4);

  return (
    <div className="pt-encoche flex flex-col gap-5 px-5">
      <Link href="/sport/videos" className="inline-flex items-center gap-1 text-[15px] text-texte-2">
        <IconeRetour className="size-5" /> Vidéos d’exercices
      </Link>
      <h1 className="font-titre text-[28px] font-bold leading-tight">{video.titre}</h1>
      <LecteurYoutube id={video.youtube_id} titre={video.titre} />

      {sesFiltres.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sesFiltres.map((f) => (
            <Etiquette key={f.id} ton={f.famille === "groupe" ? "rose" : "sable"}>
              {f.nom}
            </Etiquette>
          ))}
        </div>
      )}

      {video.description && <p className="whitespace-pre-wrap text-[15.5px] text-texte-2">{video.description}</p>}

      {video.points_cles.length > 0 && (
        <section className="flex flex-col gap-3 rounded-carte bg-blanc-casse p-5 shadow-douce">
          <h2 className="font-titre text-xl font-bold">Les points clés</h2>
          <ul className="flex flex-col gap-2.5">
            {video.points_cles.map((p, i) => (
              <li key={i} className="flex gap-3 text-[15px]">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-succes-pale text-succes">
                  <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden>
                    <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {p}
              </li>
            ))}
          </ul>
        </section>
      )}

      {video.erreurs.length > 0 && (
        <section className="flex flex-col gap-3 rounded-carte bg-accent-pale/50 p-5">
          <h2 className="font-titre text-xl font-bold">Les erreurs fréquentes</h2>
          <ul className="flex flex-col gap-2.5">
            {video.erreurs.map((e, i) => (
              <li key={i} className="flex gap-3 text-[15px]">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-pale text-accent-fonce">
                  <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden>
                    <path d="M7 7l10 10M17 7L7 17" strokeLinecap="round" />
                  </svg>
                </span>
                {e}
              </li>
            ))}
          </ul>
        </section>
      )}

      {similaires.length > 0 && (
        <section className="flex flex-col gap-3 pt-2">
          <Surtitre>Pour les mêmes muscles</Surtitre>
          <div className="grid grid-cols-2 gap-3">
            {similaires.map((v) => (
              <CarteVideo key={v.id} video={v} filtres={filtres} href={`/sport/videos/${v.id}`} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
