"use client";

import { useState, useTransition } from "react";
import { Bouton, Message } from "@/components/ui";
import { demanderSuite, type EtatSuite } from "@/app/bilan-fin-actions";
import type { Offre } from "@/lib/bilan-fin";

/** Bloc « Continuer avec moi » : le texte et les offres de Cindy, avec « Ça m'intéresse ». */
export function BlocSuite({ texte, offres, demandees }: { texte: string; offres: Offre[]; demandees: string[] }) {
  const [faites, setFaites] = useState(demandees);
  const [etat, setEtat] = useState<EtatSuite>({});
  const [enCours, demarrer] = useTransition();
  if (!offres.length && !texte) return null;
  return (
    <section aria-labelledby="titre-suite" className="flex flex-col gap-4 rounded-bloc bg-blanc-casse p-5 shadow-douce">
      <h2 id="titre-suite" className="font-titre text-[22px] font-bold">
        Continuer avec moi
      </h2>
      {texte && <p className="whitespace-pre-line text-[15.5px] leading-relaxed">{texte}</p>}
      <ul className="flex flex-col gap-3">
        {offres.map((o) => {
          const fait = faites.includes(o.titre);
          return (
            <li key={o.titre} className="flex flex-col gap-2 rounded-carte border border-ligne bg-white/70 p-4">
              <span className="font-medium">{o.titre}</span>
              {o.description && <span className="whitespace-pre-line text-[14.5px] text-texte-2">{o.description}</span>}
              {fait ? (
                <span className="text-[14px] font-medium text-succes">Demande envoyée à Cindy ✓</span>
              ) : (
                <Bouton
                  className="w-fit"
                  disabled={enCours}
                  onClick={() =>
                    demarrer(async () => {
                      const r = await demanderSuite(o.titre);
                      setEtat(r);
                      if (!r.erreur) setFaites((f) => [...f, o.titre]);
                    })
                  }
                >
                  Ça m’intéresse
                </Bouton>
              )}
            </li>
          );
        })}
      </ul>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
    </section>
  );
}
