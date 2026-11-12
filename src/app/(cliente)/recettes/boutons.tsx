"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { IconeCoeur, IconePanier } from "@/components/icones";
import { Message, classesBouton, cx } from "@/components/ui";
import { ajouterAuxCourses, basculerFavori } from "./actions";

export function BoutonFavori({ recetteId, favori }: { recetteId: string; favori: boolean }) {
  const [affiche, basculerAffiche] = useOptimistic(favori, (_e, v: boolean) => v);
  const [erreur, setErreur] = useState<string>();
  const [, demarrer] = useTransition();
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        aria-pressed={affiche}
        aria-label={affiche ? "Retirer de mes favoris" : "Ajouter à mes favoris"}
        onClick={() =>
          demarrer(async () => {
            basculerAffiche(!affiche);
            const r = await basculerFavori(recetteId);
            setErreur(r.erreur);
          })
        }
        className={cx(
          "flex size-12 items-center justify-center rounded-full shadow-douce transition-colors",
          affiche ? "bg-accent text-white" : "bg-blanc-casse text-chocolat",
        )}
      >
        <IconeCoeur className="size-6" fill={affiche ? "currentColor" : "none"} />
      </button>
      {erreur && <span className="text-[12.5px] text-erreur">{erreur}</span>}
    </div>
  );
}

export function BoutonCourses({ recetteId, indexRepas, portions }: { recetteId: string; indexRepas: number; portions: number }) {
  const [etat, setEtat] = useState<{ erreur?: string; succes?: string }>({});
  const [enCours, demarrer] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={enCours}
        onClick={() => demarrer(async () => setEtat(await ajouterAuxCourses(recetteId, indexRepas, portions)))}
        className={classesBouton("principal", true)}
      >
        <IconePanier className="size-5" />
        {enCours ? "Ajout…" : portions > 1 ? `Ajouter à ma liste de courses (${portions} portions)` : "Ajouter à ma liste de courses"}
      </button>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && (
        <Message ton="succes">
          {etat.succes}{" "}
          <Link href="/recettes/courses" className="font-medium underline">
            Voir ma liste
          </Link>
        </Message>
      )}
    </div>
  );
}
