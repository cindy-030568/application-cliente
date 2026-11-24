"use client";

import { useOptimistic, useTransition } from "react";
import { IconeCoeur } from "@/components/icones";
import { cx } from "@/components/ui";
import { basculerFavoriExpress } from "@/app/programme-actions";

/** Cœur : met une séance express en favori (enregistré tout de suite). */
export function CoeurExpress({ id, favori, titre }: { id: string; favori: boolean; titre: string }) {
  const [actif, setActif] = useOptimistic(favori);
  const [, demarrer] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={actif}
      aria-label={actif ? `Retirer « ${titre} » de mes favoris` : `Ajouter « ${titre} » à mes favoris`}
      onClick={() =>
        demarrer(async () => {
          setActif(!actif);
          await basculerFavoriExpress(id, !actif);
        })
      }
      className={cx("flex size-11 shrink-0 items-center justify-center rounded-full transition-colors", actif ? "bg-accent text-white" : "bg-sable/60 text-chocolat")}
    >
      <IconeCoeur className="size-5" />
    </button>
  );
}
