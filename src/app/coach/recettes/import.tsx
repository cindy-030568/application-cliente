"use client";

import { useState, useTransition } from "react";
import { Bouton, Message } from "@/components/ui";
import { importerRecettesDepart, type EtatRecette } from "./actions";

export function BoutonImportRecettes({ principal }: { principal: boolean }) {
  const [etat, setEtat] = useState<EtatRecette>({});
  const [enCours, demarrer] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <Bouton variante={principal ? "principal" : "contour"} disabled={enCours} onClick={() => demarrer(async () => setEtat(await importerRecettesDepart()))}>
        {enCours ? "Import en cours…" : "Importer les 50 recettes de départ"}
      </Bouton>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
    </div>
  );
}
