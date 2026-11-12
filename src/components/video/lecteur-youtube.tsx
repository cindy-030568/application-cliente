"use client";

import { useState } from "react";
import { urlLecteur, urlMiniature } from "@/lib/youtube";

/**
 * Lecteur en deux temps : une image d'aperçu, puis le lecteur YouTube
 * (domaine sans cookie) chargé seulement quand la cliente appuie sur Lecture.
 */
export function LecteurYoutube({ id, titre }: { id: string; titre: string }) {
  const [lecture, setLecture] = useState(false);
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-bloc bg-chocolat shadow-douce">
      {lecture ? (
        <iframe
          src={urlLecteur(id)}
          title={titre}
          className="absolute inset-0 size-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button
          type="button"
          onClick={() => setLecture(true)}
          className="group absolute inset-0 flex items-center justify-center"
          aria-label={`Lire la vidéo : ${titre}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urlMiniature(id)} alt="" className="absolute inset-0 size-full object-cover opacity-90" />
          <span className="absolute inset-0 bg-gradient-to-t from-chocolat/60 to-transparent" />
          <span className="relative flex size-16 items-center justify-center rounded-full bg-accent text-white shadow-bouton transition-transform group-hover:scale-105 group-active:scale-95">
            <svg viewBox="0 0 24 24" className="ml-1 size-7" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
