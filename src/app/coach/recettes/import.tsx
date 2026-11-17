"use client";

import { useState, useTransition } from "react";
import { Bouton, Message } from "@/components/ui";
import { importerRecettesDepart, mettreAJourPhotosDepart, type EtatRecette } from "./actions";

/**
 * Boutons de la carte « recettes de départ » :
 * - importer celles qui manquent (`importer` = leur nombre) ;
 * - installer les nouvelles photos fournies (`photos`), sans toucher aux recettes.
 */
export function BoutonImportRecettes({ importer = 0, photos = false, principal = false }: { importer?: number; photos?: boolean; principal?: boolean }) {
  const [etat, setEtat] = useState<EtatRecette>({});
  const [enCours, demarrer] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {importer > 0 && (
          <Bouton variante="principal" disabled={enCours} onClick={() => demarrer(async () => setEtat(await importerRecettesDepart(false)))}>
            {enCours ? "En cours…" : principal ? `Importer les ${importer} recettes de départ` : `Ajouter ${importer > 1 ? `les ${importer} recettes` : "la recette"}`}
          </Bouton>
        )}
        {photos && (
          <Bouton variante={importer > 0 ? "contour" : "principal"} disabled={enCours} onClick={() => demarrer(async () => setEtat(await mettreAJourPhotosDepart()))}>
            {enCours ? "En cours…" : "Ajouter les nouvelles photos"}
          </Bouton>
        )}
      </div>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
    </div>
  );
}
