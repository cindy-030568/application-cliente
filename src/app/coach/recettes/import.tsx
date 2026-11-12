"use client";

import { useState, useTransition } from "react";
import { Bouton, Message } from "@/components/ui";
import { importerRecettesDepart, type EtatRecette } from "./actions";

const AVERTISSEMENT =
  "Les recettes de départ vont être remises dans leur dernière version (titre, ingrédients, étapes). " +
  "Les modifications que tu leur as faites seront remplacées. Tes photos, tes brouillons et tes propres recettes ne changent pas. Continuer ?";

export function BoutonImportRecettes({ principal, misesAJourPossibles }: { principal: boolean; misesAJourPossibles: boolean }) {
  const [etat, setEtat] = useState<EtatRecette>({});
  const [enCours, demarrer] = useTransition();
  const lancer = (mettreAJour: boolean) => {
    if (mettreAJour && !window.confirm(AVERTISSEMENT)) return;
    demarrer(async () => setEtat(await importerRecettesDepart(mettreAJour)));
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Bouton variante={principal ? "principal" : "contour"} disabled={enCours} onClick={() => lancer(false)}>
          {enCours ? "En cours…" : principal ? "Importer les 50 recettes de départ" : "Importer les recettes manquantes"}
        </Bouton>
        {misesAJourPossibles && (
          <Bouton variante="contour" disabled={enCours} onClick={() => lancer(true)}>
            Mettre à jour les recettes de départ
          </Bouton>
        )}
      </div>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
    </div>
  );
}
