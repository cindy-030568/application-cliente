"use client";

import { useOptimistic, useTransition } from "react";
import { IconeCoeur } from "@/components/icones";
import { cx } from "@/components/ui";
import { basculerFavoriRessource } from "@/app/ressources-actions";

/** Cœur : met une ressource dans « Mes favoris » (enregistré tout de suite, sur son compte). */
export function CoeurRessource({ id, favori, titre, clair = false }: { id: string; favori: boolean; titre: string; clair?: boolean }) {
  const [actif, setActif] = useOptimistic(favori);
  const [, demarrer] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={actif}
      aria-label={actif ? `Retirer « ${titre} » de mes favoris` : `Ajouter « ${titre} » à mes favoris`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        demarrer(async () => {
          setActif(!actif);
          await basculerFavoriRessource(id, !actif);
        });
      }}
      className={cx(
        "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors",
        actif ? "bg-accent text-white" : clair ? "bg-blanc-casse text-chocolat shadow-douce" : "bg-sable/60 text-chocolat",
      )}
    >
      <IconeCoeur className="size-5" />
    </button>
  );
}
