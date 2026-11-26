"use client";

import { useState, useTransition } from "react";
import { Bouton, Message } from "@/components/ui";
import { gererAbonnement } from "./actions";

export function BoutonGerer() {
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <Bouton
        variante="contour"
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            const r = await gererAbonnement();
            if (r?.erreur) setErreur(r.erreur);
          })
        }
      >
        {enCours ? "Ouverture…" : "Gérer mon abonnement"}
      </Bouton>
      {erreur && <Message ton="erreur">{erreur}</Message>}
    </div>
  );
}
