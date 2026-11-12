import Link from "next/link";
import type { FiltreVideo, Video } from "@/lib/types";
import { urlMiniature } from "@/lib/youtube";

export function CarteVideo({ video, filtres, href }: { video: Video; filtres: FiltreVideo[]; href: string }) {
  const etiquettes = filtres.filter((f) => video.filtres.includes(f.id) && f.famille !== "categorie").slice(0, 3);
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-carte bg-blanc-casse shadow-douce transition-transform active:scale-[0.98]"
    >
      <span className="relative aspect-video overflow-hidden bg-sable">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urlMiniature(video.youtube_id, "mq")}
          alt=""
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <span className="absolute bottom-2 right-2 flex size-8 items-center justify-center rounded-full bg-accent text-white">
          <svg viewBox="0 0 24 24" className="ml-0.5 size-4" fill="currentColor" aria-hidden>
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
          </svg>
        </span>
      </span>
      <span className="flex flex-col gap-1.5 p-3">
        <span className="font-medium leading-snug">{video.titre}</span>
        {etiquettes.length > 0 && (
          <span className="text-[12.5px] leading-snug text-texte-2">{etiquettes.map((f) => f.nom).join(" · ")}</span>
        )}
      </span>
    </Link>
  );
}
