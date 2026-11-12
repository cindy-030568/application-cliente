"use client";

import { useState, useTransition } from "react";
import { Bouton, Message } from "@/components/ui";
import { importerCiqual, type EtatAliment } from "./actions";

export function BoutonImportCiqual({ premier }: { premier: boolean }) {
  const [etat, setEtat] = useState<EtatAliment>({});
  const [enCours, demarrer] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <Bouton
        variante={premier ? "principal" : "contour"}
        disabled={enCours}
        onClick={() => demarrer(async () => setEtat(await importerCiqual()))}
      >
        {enCours
          ? "Import en cours… (environ 30 secondes)"
          : premier
            ? "Importer la table Ciqual (3 049 aliments)"
            : "Mettre à jour depuis Ciqual"}
      </Bouton>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
    </div>
  );
}
