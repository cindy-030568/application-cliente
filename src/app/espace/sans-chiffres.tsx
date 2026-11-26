"use client";

import { useState, useTransition } from "react";
import { Message } from "@/components/ui";
import { definirSansChiffresAbonnee } from "./actions";

/** Interrupteur « Mode sans chiffres » de l'abonnée. */
export function InterrupteurSansChiffres({ actif: initial }: { actif: boolean }) {
  const [actif, setActif] = useState(initial);
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();
  const basculer = () => {
    const valeur = !actif;
    setActif(valeur);
    setErreur(undefined);
    demarrer(async () => {
      const r = await definirSansChiffresAbonnee(valeur);
      if (r.erreur) {
        setErreur(r.erreur);
        setActif(!valeur);
      }
    });
  };
  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span className="flex flex-col">
          <span className="font-medium">Mode sans chiffres</span>
          <span className="text-[13.5px] text-texte-2">Je ne vois plus mon poids nulle part : seulement mes ressentis.</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={actif}
          disabled={enCours}
          onChange={basculer}
          className="size-6 shrink-0 accent-chocolat"
        />
      </label>
      {erreur && <Message ton="erreur">{erreur}</Message>}
    </div>
  );
}
